import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BenefitKind,
  BenefitSubscriptionStatus,
  ClinicalAppointmentProcedureOrigin,
  ClinicalAppointmentStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  Prisma,
} from '@prisma/client';
import { todayYmdSaoPaulo } from '../common/datetime/sao-paulo-day-bounds';
import { decimalToNumber } from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import { currentSubscriptionWhere } from './current-subscription';
import { AddBenefitDependentDto } from './dto/add-benefit-dependent.dto';
import { CreateBenefitNoteDto } from './dto/create-benefit-note.dto';
import { CreateBenefitSubscriptionDto } from './dto/create-benefit-subscription.dto';
import { ListBenefitSubscriptionsQueryDto } from './dto/list-benefit-subscriptions-query.dto';
import {
  addYearsYmd,
  centsListToMoney,
  dueYmd,
  splitInstallmentCents,
  ymdToUtcDate,
} from './installments';
import { randomUUID } from 'crypto';

const STATUSES_THAT_RESERVE: ClinicalAppointmentStatus[] = [
  ClinicalAppointmentStatus.marked,
  ClinicalAppointmentStatus.confirmed,
  ClinicalAppointmentStatus.waiting,
  ClinicalAppointmentStatus.attended,
];

const subscriptionInclude = {
  patient: true,
  plan: true,
  dependents: {
    include: { patient: true },
    orderBy: { id: 'asc' as const },
  },
  entitlements: {
    include: {
      procedures: {
        include: { procedure: true },
        orderBy: { id: 'asc' as const },
      },
      notes: { orderBy: { id: 'desc' as const } },
    },
    orderBy: { id: 'asc' as const },
  },
  financialEntries: { orderBy: { installmentNumber: 'asc' as const } },
} as const;

type SubscriptionRecord = Prisma.BenefitSubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

@Injectable()
export class BenefitSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBenefitSubscriptionDto) {
    const startsYmd = dto.startsAt.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsYmd)) {
      throw new BadRequestException('startsAt must be a calendar date');
    }
    const dependentIds = dto.dependentPatientIds ?? [];
    if (dependentIds.includes(dto.patientId)) {
      throw new BadRequestException('Holder cannot also be a dependent');
    }

    const patientIds = [dto.patientId, ...dependentIds];
    await this.ensurePatientsExist(patientIds);
    await this.ensurePatientsFree(patientIds);

    const plan = await this.prisma.benefitPlan.findUnique({
      where: { id: dto.planId },
      include: {
        benefits: { include: { procedures: true } },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Benefit plan ${dto.planId} not found`);
    }
    if (!plan.isActive) {
      throw new BadRequestException(`Benefit plan ${dto.planId} is inactive`);
    }
    if (plan.benefits.length === 0) {
      throw new BadRequestException(
        `Benefit plan ${dto.planId} has no benefits`,
      );
    }

    const expiresYmd = addYearsYmd(startsYmd, 1);
    const amounts = centsListToMoney(
      splitInstallmentCents({
        annualPrice: decimalToNumber(plan.annualPrice),
        installmentCount: dto.installmentCount,
        adhesionFee: decimalToNumber(plan.adhesionFee),
        dependentFee: decimalToNumber(plan.dependentFee),
        dependentCount: dependentIds.length,
      }),
    );

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.benefitSubscription.create({
        data: {
          patientId: dto.patientId,
          planId: dto.planId,
          startsAt: ymdToUtcDate(startsYmd),
          expiresAt: ymdToUtcDate(expiresYmd),
          billingDay: dto.billingDay,
          installmentCount: dto.installmentCount,
          status: BenefitSubscriptionStatus.active,
          cardNumber: `TMP${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          dependents: {
            create: dependentIds.map((patientId) => ({ patientId })),
          },
          entitlements: {
            create: plan.benefits.map((benefit) => ({
              benefitId: benefit.id,
              kind: benefit.kind,
              title: benefit.title,
              quantity: benefit.quantity,
              usedQuantity: 0,
              discountPercent: benefit.discountPercent,
              procedures: {
                create: benefit.procedures.map((item) => ({
                  procedureId: item.procedureId,
                })),
              },
            })),
          },
        },
      });

      const cardNumber = `LC${String(created.id).padStart(8, '0')}`;
      await tx.benefitSubscription.update({
        where: { id: created.id },
        data: { cardNumber },
      });

      await tx.financialEntry.createMany({
        data: amounts.map((amount, index) => ({
          type: FinancialEntryType.benefit_subscription,
          status: FinancialEntryStatus.pending,
          grossAmount: amount,
          discountAmount: 0,
          surchargeAmount: 0,
          amount,
          receivedAmount: 0,
          notes: `Cartão ${cardNumber} — parcela ${index + 1}/${dto.installmentCount}`,
          benefitSubscriptionId: created.id,
          dueDate: ymdToUtcDate(dueYmd(startsYmd, index, dto.billingDay)),
          installmentNumber: index + 1,
        })),
      });

      return tx.benefitSubscription.findUniqueOrThrow({
        where: { id: created.id },
        include: subscriptionInclude,
      });
    });
  }

  async findAll(query: ListBenefitSubscriptionsQueryDto) {
    if (query.patientId === undefined) {
      throw new BadRequestException('patientId is required');
    }
    const records = await this.prisma.benefitSubscription.findMany({
      where: {
        OR: [
          { patientId: query.patientId },
          { dependents: { some: { patientId: query.patientId } } },
        ],
      },
      orderBy: { id: 'desc' },
      include: subscriptionInclude,
    });
    return this.withRemaining(records, query.excludeAppointmentId);
  }

  async findOne(id: number, excludeAppointmentId?: number) {
    const record = await this.prisma.benefitSubscription.findUnique({
      where: { id },
      include: subscriptionInclude,
    });
    if (!record) {
      throw new NotFoundException(`Benefit subscription ${id} not found`);
    }
    const [mapped] = await this.withRemaining([record], excludeAppointmentId);
    return mapped;
  }

  async cancel(id: number) {
    const record = await this.findOne(id);
    if (record.status === BenefitSubscriptionStatus.cancelled) {
      throw new BadRequestException(
        `Benefit subscription ${id} is already cancelled`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.financialEntry.updateMany({
        where: {
          benefitSubscriptionId: id,
          status: FinancialEntryStatus.pending,
        },
        data: { status: FinancialEntryStatus.cancelled },
      });
      await tx.benefitSubscription.update({
        where: { id },
        data: { status: BenefitSubscriptionStatus.cancelled },
      });
      return tx.benefitSubscription.findUniqueOrThrow({
        where: { id },
        include: subscriptionInclude,
      });
    });
  }

  async addDependent(id: number, dto: AddBenefitDependentDto) {
    const record = await this.findOne(id);
    this.ensureOpen(record);
    if (dto.patientId === record.patientId) {
      throw new BadRequestException('Holder cannot also be a dependent');
    }
    if (record.dependents.some((item) => item.patientId === dto.patientId)) {
      throw new BadRequestException(
        `Patient ${dto.patientId} is already a dependent of subscription ${id}`,
      );
    }
    await this.ensurePatientsExist([dto.patientId]);
    await this.ensurePatientsFree([dto.patientId]);

    await this.prisma.benefitSubscriptionDependent.create({
      data: { subscriptionId: id, patientId: dto.patientId },
    });
    return this.findOne(id);
  }

  async removeDependent(id: number, patientId: number) {
    const record = await this.findOne(id);
    const dependent = record.dependents.find(
      (item) => item.patientId === patientId,
    );
    if (!dependent) {
      throw new NotFoundException(
        `Patient ${patientId} is not a dependent of subscription ${id}`,
      );
    }
    await this.prisma.benefitSubscriptionDependent.delete({
      where: { id: dependent.id },
    });
    return this.findOne(id);
  }

  async addNote(
    subscriptionId: number,
    entitlementId: number,
    dto: CreateBenefitNoteDto,
  ) {
    const record = await this.findOne(subscriptionId);
    const entitlement = record.entitlements.find(
      (item) => item.id === entitlementId,
    );
    if (!entitlement) {
      throw new NotFoundException(
        `Benefit entitlement ${entitlementId} not found on subscription ${subscriptionId}`,
      );
    }
    await this.prisma.benefitNote.create({
      data: {
        entitlementId,
        description: dto.description.trim(),
      },
    });
    return this.findOne(subscriptionId);
  }

  async currentDiscountPercent(
    patientId: number,
    onYmd: string,
  ): Promise<number> {
    const subscription = await this.prisma.benefitSubscription.findFirst({
      where: currentSubscriptionWhere(patientId, ymdToUtcDate(onYmd)),
      include: { entitlements: true },
      orderBy: { id: 'desc' },
    });
    if (!subscription) {
      return 0;
    }
    const percents = subscription.entitlements
      .filter(
        (item) =>
          item.kind === BenefitKind.discount && item.discountPercent != null,
      )
      .map((item) => decimalToNumber(item.discountPercent as Prisma.Decimal));
    if (percents.length === 0) {
      return 0;
    }
    return Math.max(...percents);
  }

  private ensureOpen(record: {
    id: number;
    status: BenefitSubscriptionStatus;
    expiresAt: Date;
  }) {
    if (record.status !== BenefitSubscriptionStatus.active) {
      throw new BadRequestException(
        `Benefit subscription ${record.id} is not active`,
      );
    }
    const today = ymdToUtcDate(todayYmdSaoPaulo());
    if (record.expiresAt < today) {
      throw new BadRequestException(
        `Benefit subscription ${record.id} is expired`,
      );
    }
  }

  private async ensurePatientsExist(patientIds: number[]) {
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true },
    });
    if (patients.length !== patientIds.length) {
      const found = new Set(patients.map((item) => item.id));
      const missing = patientIds.find((id) => !found.has(id));
      throw new NotFoundException(`Patient ${missing} not found`);
    }
  }

  private async ensurePatientsFree(patientIds: number[]) {
    const today = ymdToUtcDate(todayYmdSaoPaulo());
    const existing = await this.prisma.benefitSubscription.findFirst({
      where: {
        status: BenefitSubscriptionStatus.active,
        expiresAt: { gte: today },
        OR: [
          { patientId: { in: patientIds } },
          { dependents: { some: { patientId: { in: patientIds } } } },
        ],
      },
      select: {
        id: true,
        patientId: true,
        dependents: { select: { patientId: true } },
      },
    });
    if (!existing) {
      return;
    }
    const members = new Set([
      existing.patientId,
      ...existing.dependents.map((item) => item.patientId),
    ]);
    const blocked = patientIds.find((id) => members.has(id)) ?? patientIds[0];
    throw new BadRequestException(
      `Patient ${blocked} already participates in active benefit subscription ${existing.id}`,
    );
  }

  private async withRemaining(
    records: SubscriptionRecord[],
    excludeAppointmentId?: number,
  ) {
    const entitlementIds = records.flatMap((record) =>
      record.entitlements
        .filter((item) => item.kind === BenefitKind.quota)
        .map((item) => item.id),
    );
    const reservedById = await this.reservedQuantities(
      entitlementIds,
      excludeAppointmentId,
    );
    const today = ymdToUtcDate(todayYmdSaoPaulo());

    return records.map((record) => ({
      ...record,
      isCurrent:
        record.status === BenefitSubscriptionStatus.active &&
        record.startsAt <= today &&
        record.expiresAt >= today,
      discountPercent: this.discountOf(record),
      entitlements: record.entitlements.map((item) => {
        if (item.kind !== BenefitKind.quota || item.quantity == null) {
          return {
            ...item,
            reservedQuantity: 0,
            remainingQuantity: null,
          };
        }
        const reserved = reservedById.get(item.id) ?? 0;
        return {
          ...item,
          reservedQuantity: reserved,
          remainingQuantity: Math.max(
            0,
            item.quantity - item.usedQuantity - reserved,
          ),
        };
      }),
    }));
  }

  private discountOf(record: SubscriptionRecord): number | null {
    const percents = record.entitlements
      .filter(
        (item) =>
          item.kind === BenefitKind.discount && item.discountPercent != null,
      )
      .map((item) => decimalToNumber(item.discountPercent as Prisma.Decimal));
    if (percents.length === 0) {
      return null;
    }
    return Math.max(...percents);
  }

  private async reservedQuantities(
    entitlementIds: number[],
    excludeAppointmentId?: number,
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (entitlementIds.length === 0) {
      return map;
    }
    const grouped = await this.prisma.clinicalAppointmentProcedure.groupBy({
      by: ['benefitEntitlementId'],
      where: {
        origin: ClinicalAppointmentProcedureOrigin.benefit,
        benefitEntitlementId: { in: entitlementIds },
        clinicalAppointment: {
          status: { in: STATUSES_THAT_RESERVE },
          ...(excludeAppointmentId !== undefined && {
            id: { not: excludeAppointmentId },
          }),
        },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.benefitEntitlementId != null) {
        map.set(row.benefitEntitlementId, row._count._all);
      }
    }
    return map;
  }
}

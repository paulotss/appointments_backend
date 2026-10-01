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
  ClinicalAppointmentType,
  PatientPackageStatus,
  Prisma,
} from '@prisma/client';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
  todayYmdSaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import { HealthProfessionalsService } from '../health-professionals/health-professionals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ymdToUtcDate } from '../benefit-subscriptions/installments';
import {
  BenefitEntitlementUseDto,
  CreateClinicalAppointmentDto,
} from './dto/create-clinical-appointment.dto';
import { ListClinicalAppointmentsQueryDto } from './dto/list-clinical-appointments-query.dto';
import { UpdateClinicalAppointmentDto } from './dto/update-clinical-appointment.dto';

const STATUSES_THAT_RESERVE: ClinicalAppointmentStatus[] = [
  ClinicalAppointmentStatus.marked,
  ClinicalAppointmentStatus.confirmed,
  ClinicalAppointmentStatus.waiting,
  ClinicalAppointmentStatus.attended,
];

const appointmentInclude = {
  patient: true,
  healthProfessional: true,
  insuranceGuides: {
    include: {
      insuranceGuide: {
        include: {
          healthPlan: true,
          procedures: {
            include: { procedure: { include: { healthPlanPrices: true } } },
          },
        },
      },
    },
  },
  procedures: {
    include: {
      procedure: true,
      patientPackageItem: {
        include: { patientPackage: { include: { package: true } } },
      },
      benefitEntitlement: {
        include: { subscription: { include: { plan: true } } },
      },
      insuranceGuide: true,
    },
  },
} as const;

const guideForAppointmentInclude = {
  procedures: { include: { procedure: true } },
  billingBatchGuide: true,
} as const;

type GuideForAppointment = Prisma.InsuranceGuideGetPayload<{
  include: typeof guideForAppointmentInclude;
}>;

type ProcedureLine = {
  procedureId: number;
  origin: ClinicalAppointmentProcedureOrigin;
  patientPackageItemId?: number;
  insuranceGuideId?: number;
  benefitEntitlementId?: number;
};

@Injectable()
export class ClinicalAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthProfessionalsService: HealthProfessionalsService,
  ) {}

  async create(createDto: CreateClinicalAppointmentDto) {
    await this.ensurePatientExists(createDto.patientId);
    await this.ensureHealthProfessionalExists(createDto.healthProfessionalId);

    const status = createDto.status ?? ClinicalAppointmentStatus.marked;
    const scheduledAt = new Date(createDto.scheduledAt);
    const endsAt = new Date(createDto.endsAt);
    this.ensureValidInterval(scheduledAt, endsAt);
    await this.healthProfessionalsService.assertSlotAvailable(
      createDto.healthProfessionalId,
      scheduledAt,
      endsAt,
    );

    const resolved = await this.resolveProcedureLines({
      patientId: createDto.patientId,
      healthProfessionalId: createDto.healthProfessionalId,
      procedureIds: createDto.procedureIds ?? [],
      patientPackageItemIds: createDto.patientPackageItemIds ?? [],
      insuranceGuideIds: createDto.insuranceGuideIds ?? [],
      benefitUses: createDto.benefitUses ?? [],
      onYmd: todayYmdSaoPaulo(scheduledAt),
      consumeNow: status === ClinicalAppointmentStatus.finished,
    });

    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.clinicalAppointment.create({
        data: {
          patientId: createDto.patientId,
          healthProfessionalId: createDto.healthProfessionalId,
          scheduledAt,
          endsAt,
          status,
          type: resolved.type,
          notes: createDto.notes,
          insuranceGuides: {
            create: resolved.insuranceGuideIds.map((insuranceGuideId) => ({
              insuranceGuideId,
            })),
          },
          procedures: {
            create: resolved.lines.map((line) => ({
              procedureId: line.procedureId,
              origin: line.origin,
              patientPackageItemId: line.patientPackageItemId,
              insuranceGuideId: line.insuranceGuideId,
              benefitEntitlementId: line.benefitEntitlementId,
            })),
          },
        },
        include: appointmentInclude,
      });

      if (status === ClinicalAppointmentStatus.finished) {
        await this.consumeGuides(tx, resolved.guides);
        await this.consumePackageItems(tx, resolved.packageItemIds);
        await this.consumeBenefitEntitlements(
          tx,
          resolved.benefitEntitlementIds,
        );
      }

      return tx.clinicalAppointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: appointmentInclude,
      });
    });
  }

  findAll(query: ListClinicalAppointmentsQueryDto) {
    const scheduledAtFilter =
      query.from !== undefined || query.to !== undefined
        ? {
            ...(query.from !== undefined && {
              gte: startOfDaySaoPaulo(query.from.slice(0, 10)),
            }),
            ...(query.to !== undefined && {
              lte: endOfDaySaoPaulo(query.to.slice(0, 10)),
            }),
          }
        : undefined;

    return this.prisma.clinicalAppointment.findMany({
      where: {
        ...(query.patientId !== undefined && { patientId: query.patientId }),
        ...(query.healthProfessionalId !== undefined && {
          healthProfessionalId: query.healthProfessionalId,
        }),
        ...(query.status !== undefined && { status: query.status }),
        ...(query.type !== undefined && { type: query.type }),
        ...(query.insuranceGuideId !== undefined && {
          insuranceGuides: {
            some: { insuranceGuideId: query.insuranceGuideId },
          },
        }),
        ...(scheduledAtFilter !== undefined && {
          scheduledAt: scheduledAtFilter,
        }),
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      include: appointmentInclude,
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.clinicalAppointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });

    if (!appointment) {
      throw new NotFoundException(`Clinical appointment ${id} not found`);
    }

    return appointment;
  }

  async update(id: number, updateDto: UpdateClinicalAppointmentDto) {
    const existing = await this.findOne(id);

    const nextPatientId = updateDto.patientId ?? existing.patientId;
    const nextProfessionalId =
      updateDto.healthProfessionalId ?? existing.healthProfessionalId;
    const nextStatus = updateDto.status ?? existing.status;
    const nextScheduledAt =
      updateDto.scheduledAt !== undefined
        ? new Date(updateDto.scheduledAt)
        : existing.scheduledAt;
    const nextEndsAt =
      updateDto.endsAt !== undefined
        ? new Date(updateDto.endsAt)
        : existing.endsAt;
    this.ensureValidInterval(nextScheduledAt, nextEndsAt);
    const slotChanged =
      nextProfessionalId !== existing.healthProfessionalId ||
      nextScheduledAt.getTime() !== existing.scheduledAt.getTime() ||
      nextEndsAt.getTime() !== existing.endsAt.getTime();
    if (slotChanged) {
      await this.healthProfessionalsService.assertSlotAvailable(
        nextProfessionalId,
        nextScheduledAt,
        nextEndsAt,
      );
    }

    if (updateDto.patientId !== undefined) {
      await this.ensurePatientExists(updateDto.patientId);
    }

    if (updateDto.healthProfessionalId !== undefined) {
      await this.ensureHealthProfessionalExists(updateDto.healthProfessionalId);
    }

    const existingPrivateIds = existing.procedures
      .filter(
        (item) => item.origin === ClinicalAppointmentProcedureOrigin.private,
      )
      .map((item) => item.procedureId);
    const existingPackageItemIds = existing.procedures
      .filter(
        (item) =>
          item.origin === ClinicalAppointmentProcedureOrigin.package &&
          item.patientPackageItemId != null,
      )
      .map((item) => item.patientPackageItemId as number);
    const existingGuideIds = existing.insuranceGuides.map(
      (item) => item.insuranceGuideId,
    );
    const existingBenefitUses = existing.procedures
      .filter(
        (item) =>
          item.origin === ClinicalAppointmentProcedureOrigin.benefit &&
          item.benefitEntitlementId != null,
      )
      .map((item) => ({
        entitlementId: item.benefitEntitlementId as number,
        procedureId: item.procedureId,
      }));
    const existingBenefitEntitlementIds = existingBenefitUses.map(
      (item) => item.entitlementId,
    );

    const resolved = await this.resolveProcedureLines({
      patientId: nextPatientId,
      healthProfessionalId: nextProfessionalId,
      procedureIds:
        updateDto.procedureIds !== undefined
          ? updateDto.procedureIds
          : existingPrivateIds,
      patientPackageItemIds:
        updateDto.patientPackageItemIds !== undefined
          ? updateDto.patientPackageItemIds
          : existingPackageItemIds,
      insuranceGuideIds:
        updateDto.insuranceGuideIds !== undefined
          ? updateDto.insuranceGuideIds
          : existingGuideIds,
      benefitUses:
        updateDto.benefitUses !== undefined
          ? updateDto.benefitUses
          : existingBenefitUses,
      onYmd: todayYmdSaoPaulo(nextScheduledAt),
      consumeNow: nextStatus === ClinicalAppointmentStatus.finished,
      excludeAppointmentId: id,
      alreadyAssociatedGuideIds: existingGuideIds,
    });

    const existingGuidesForConsume = existing.insuranceGuides.map(
      (item) => item.insuranceGuide,
    );
    const oldConsumeKey = this.consumeKey(
      existing.status,
      existingGuidesForConsume,
      existingPackageItemIds,
      existingBenefitEntitlementIds,
    );
    const nextConsumeKey = this.consumeKey(
      nextStatus,
      resolved.guides,
      resolved.packageItemIds,
      resolved.benefitEntitlementIds,
    );

    return this.prisma.$transaction(async (tx) => {
      if (oldConsumeKey && oldConsumeKey !== nextConsumeKey) {
        await this.releaseGuides(tx, existingGuidesForConsume);
        await this.releasePackageItems(tx, existingPackageItemIds);
        await this.releaseBenefitEntitlements(
          tx,
          existingBenefitEntitlementIds,
        );
      }

      await tx.clinicalAppointmentProcedure.deleteMany({
        where: { clinicalAppointmentId: id },
      });
      await tx.clinicalAppointmentProcedure.createMany({
        data: resolved.lines.map((line) => ({
          clinicalAppointmentId: id,
          procedureId: line.procedureId,
          origin: line.origin,
          patientPackageItemId: line.patientPackageItemId,
          insuranceGuideId: line.insuranceGuideId,
          benefitEntitlementId: line.benefitEntitlementId,
        })),
      });

      await tx.clinicalAppointmentGuide.deleteMany({
        where: { clinicalAppointmentId: id },
      });
      if (resolved.insuranceGuideIds.length > 0) {
        await tx.clinicalAppointmentGuide.createMany({
          data: resolved.insuranceGuideIds.map((insuranceGuideId) => ({
            clinicalAppointmentId: id,
            insuranceGuideId,
          })),
        });
      }

      await tx.clinicalAppointment.update({
        where: { id },
        data: {
          patientId: nextPatientId,
          healthProfessionalId: nextProfessionalId,
          scheduledAt: nextScheduledAt,
          endsAt: nextEndsAt,
          status: nextStatus,
          type: resolved.type,
          ...(updateDto.notes !== undefined && { notes: updateDto.notes }),
        },
      });

      if (nextConsumeKey && oldConsumeKey !== nextConsumeKey) {
        await this.consumeGuides(tx, resolved.guides);
        await this.consumePackageItems(tx, resolved.packageItemIds);
        await this.consumeBenefitEntitlements(
          tx,
          resolved.benefitEntitlementIds,
        );
      }

      return tx.clinicalAppointment.findUniqueOrThrow({
        where: { id },
        include: appointmentInclude,
      });
    });
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    const packageItemIds = existing.procedures
      .filter(
        (item) =>
          item.origin === ClinicalAppointmentProcedureOrigin.package &&
          item.patientPackageItemId != null,
      )
      .map((item) => item.patientPackageItemId as number);
    const benefitEntitlementIds = existing.procedures
      .filter(
        (item) =>
          item.origin === ClinicalAppointmentProcedureOrigin.benefit &&
          item.benefitEntitlementId != null,
      )
      .map((item) => item.benefitEntitlementId as number);

    return this.prisma.$transaction(async (tx) => {
      const key = this.consumeKey(
        existing.status,
        existing.insuranceGuides.map((item) => item.insuranceGuide),
        packageItemIds,
        benefitEntitlementIds,
      );
      if (key) {
        await this.releaseGuides(
          tx,
          existing.insuranceGuides.map((item) => item.insuranceGuide),
        );
        await this.releasePackageItems(tx, packageItemIds);
        await this.releaseBenefitEntitlements(tx, benefitEntitlementIds);
      }

      return tx.clinicalAppointment.delete({
        where: { id },
        include: appointmentInclude,
      });
    });
  }

  private async resolveProcedureLines(params: {
    patientId: number;
    healthProfessionalId: number;
    procedureIds: number[];
    patientPackageItemIds: number[];
    insuranceGuideIds: number[];
    benefitUses: BenefitEntitlementUseDto[];
    onYmd: string;
    consumeNow: boolean;
    excludeAppointmentId?: number;
    alreadyAssociatedGuideIds?: number[];
  }): Promise<{
    lines: ProcedureLine[];
    type: ClinicalAppointmentType;
    insuranceGuideIds: number[];
    packageItemIds: number[];
    benefitEntitlementIds: number[];
    guides: GuideForAppointment[];
  }> {
    const privateIds = this.optionalUniqueIds(params.procedureIds);
    const packageItemIds = this.optionalUniqueIds(params.patientPackageItemIds);
    const insuranceGuideIds = this.optionalUniqueIds(params.insuranceGuideIds);
    const benefitUses = params.benefitUses;

    if (
      privateIds.length === 0 &&
      packageItemIds.length === 0 &&
      insuranceGuideIds.length === 0 &&
      benefitUses.length === 0
    ) {
      throw new BadRequestException(
        'At least one procedure from private, package, benefit card or health plan is required',
      );
    }

    if (privateIds.length > 0) {
      await this.ensurePrivateProceduresValid(
        params.healthProfessionalId,
        privateIds,
      );
    }

    const packageItems =
      packageItemIds.length > 0
        ? await this.ensurePackageItemsValid({
            patientId: params.patientId,
            healthProfessionalId: params.healthProfessionalId,
            patientPackageItemIds: packageItemIds,
            consumeNow: params.consumeNow,
            excludeAppointmentId: params.excludeAppointmentId,
          })
        : [];

    const benefitLines =
      benefitUses.length > 0
        ? await this.ensureBenefitUsesValid({
            patientId: params.patientId,
            healthProfessionalId: params.healthProfessionalId,
            uses: benefitUses,
            onYmd: params.onYmd,
            consumeNow: params.consumeNow,
            excludeAppointmentId: params.excludeAppointmentId,
          })
        : [];

    const guides =
      insuranceGuideIds.length > 0
        ? await this.loadAndValidateGuides({
            insuranceGuideIds,
            patientId: params.patientId,
            healthProfessionalId: params.healthProfessionalId,
            alreadyAssociatedIds: params.alreadyAssociatedGuideIds,
          })
        : [];

    const lines: ProcedureLine[] = [
      ...privateIds.map((procedureId) => ({
        procedureId,
        origin: ClinicalAppointmentProcedureOrigin.private,
      })),
      ...packageItems.map((item) => ({
        procedureId: item.procedureId,
        origin: ClinicalAppointmentProcedureOrigin.package,
        patientPackageItemId: item.id,
      })),
      ...benefitLines.map((item) => ({
        procedureId: item.procedureId,
        origin: ClinicalAppointmentProcedureOrigin.benefit,
        benefitEntitlementId: item.entitlementId,
      })),
      ...this.linesFromGuides(guides),
    ];

    this.ensureNoDuplicateProcedures(lines);

    return {
      lines,
      type: this.deriveType(lines),
      insuranceGuideIds,
      packageItemIds,
      benefitEntitlementIds: benefitLines.map((item) => item.entitlementId),
      guides,
    };
  }

  private deriveType(lines: ProcedureLine[]): ClinicalAppointmentType {
    const hasPlan = lines.some(
      (line) => line.origin === ClinicalAppointmentProcedureOrigin.health_plan,
    );
    const hasPrivateOrPackage = lines.some(
      (line) =>
        line.origin === ClinicalAppointmentProcedureOrigin.private ||
        line.origin === ClinicalAppointmentProcedureOrigin.package ||
        line.origin === ClinicalAppointmentProcedureOrigin.benefit,
    );
    if (hasPlan && hasPrivateOrPackage) {
      return ClinicalAppointmentType.mixed;
    }
    if (hasPlan) {
      return ClinicalAppointmentType.health_plan;
    }
    return ClinicalAppointmentType.private;
  }

  private linesFromGuides(guides: GuideForAppointment[]): ProcedureLine[] {
    const lines: ProcedureLine[] = [];
    const seen = new Set<number>();
    for (const guide of guides) {
      for (const item of guide.procedures) {
        if (seen.has(item.procedureId)) {
          continue;
        }
        seen.add(item.procedureId);
        lines.push({
          procedureId: item.procedureId,
          origin: ClinicalAppointmentProcedureOrigin.health_plan,
          insuranceGuideId: guide.id,
        });
      }
    }
    return lines;
  }

  private ensureNoDuplicateProcedures(lines: ProcedureLine[]) {
    const ids = lines.map((line) => line.procedureId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'The same procedure cannot be added from more than one origin in the same appointment',
      );
    }
  }

  private consumeKey(
    status: ClinicalAppointmentStatus,
    guides: Array<{ id: number; procedures: Array<{ procedureId: number }> }>,
    packageItemIds: number[],
    benefitEntitlementIds: number[] = [],
  ): string | null {
    if (status !== ClinicalAppointmentStatus.finished) {
      return null;
    }

    const guidePart = guides
      .map((guide) => {
        const procedureIds = guide.procedures
          .map((item) => item.procedureId)
          .sort((a, b) => a - b);
        return `${guide.id}:${procedureIds.join(',')}`;
      })
      .sort()
      .join('|');
    const packagePart = [...packageItemIds].sort((a, b) => a - b).join(',');
    const benefitPart = [...benefitEntitlementIds]
      .sort((a, b) => a - b)
      .join(',');
    if (!guidePart && !packagePart && !benefitPart) {
      return null;
    }
    return `${guidePart}|pkg:${packagePart}|ben:${benefitPart}`;
  }

  private ensureValidInterval(scheduledAt: Date, endsAt: Date) {
    if (endsAt.getTime() <= scheduledAt.getTime()) {
      throw new BadRequestException('endsAt must be after scheduledAt');
    }
  }

  private optionalUniqueIds(ids: number[]): number[] {
    if (ids.length === 0) {
      return [];
    }
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException('IDs cannot contain duplicates');
    }
    return unique;
  }

  private async ensurePrivateProceduresValid(
    healthProfessionalId: number,
    procedureIds: number[],
  ) {
    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true, specialtyId: true },
    });

    if (procedures.length !== procedureIds.length) {
      const found = new Set(procedures.map((item) => item.id));
      const missing = procedureIds.find((id) => !found.has(id));
      throw new NotFoundException(`Procedure ${missing} not found`);
    }

    await this.ensureProceduresMatchProfessional(
      healthProfessionalId,
      procedures,
    );
  }

  private async ensureProceduresMatchProfessional(
    healthProfessionalId: number,
    procedures: Array<{ id: number; specialtyId: number }>,
  ) {
    const links = await this.prisma.healthProfessionalSpecialty.findMany({
      where: { healthProfessionalId },
      select: { specialtyId: true },
    });
    const allowed = new Set(links.map((item) => item.specialtyId));

    for (const procedure of procedures) {
      if (!allowed.has(procedure.specialtyId)) {
        throw new NotFoundException(
          `Health professional ${healthProfessionalId} does not have specialty ${procedure.specialtyId} required by procedure ${procedure.id}`,
        );
      }
    }
  }

  private async ensurePackageItemsValid(params: {
    patientId: number;
    healthProfessionalId: number;
    patientPackageItemIds: number[];
    consumeNow: boolean;
    excludeAppointmentId?: number;
  }): Promise<Array<{ id: number; procedureId: number }>> {
    const items = await this.prisma.patientPackageItem.findMany({
      where: { id: { in: params.patientPackageItemIds } },
      include: {
        procedure: { select: { id: true, specialtyId: true } },
        patientPackage: true,
      },
    });

    if (items.length !== params.patientPackageItemIds.length) {
      const found = new Set(items.map((item) => item.id));
      const missing = params.patientPackageItemIds.find((id) => !found.has(id));
      throw new NotFoundException(`Patient package item ${missing} not found`);
    }

    const reservedByItemId = await this.reservedPackageQuantities(
      params.patientPackageItemIds,
      params.excludeAppointmentId,
    );

    await this.ensureProceduresMatchProfessional(
      params.healthProfessionalId,
      items.map((item) => item.procedure),
    );

    for (const item of items) {
      if (item.patientPackage.patientId !== params.patientId) {
        throw new BadRequestException(
          `Patient package item ${item.id} does not belong to patient ${params.patientId}`,
        );
      }
      if (item.patientPackage.status === PatientPackageStatus.cancelled) {
        throw new BadRequestException(
          `Patient package ${item.patientPackageId} is cancelled`,
        );
      }
      const reserved = params.consumeNow
        ? 0
        : (reservedByItemId.get(item.id) ?? 0);
      const remaining = item.quantity - item.usedQuantity - reserved;
      if (remaining <= 0) {
        throw new BadRequestException(
          `Patient package item ${item.id} has no remaining quantity`,
        );
      }
    }

    return items.map((item) => ({
      id: item.id,
      procedureId: item.procedureId,
    }));
  }

  private async ensureBenefitUsesValid(params: {
    patientId: number;
    healthProfessionalId: number;
    uses: BenefitEntitlementUseDto[];
    onYmd: string;
    consumeNow: boolean;
    excludeAppointmentId?: number;
  }): Promise<BenefitEntitlementUseDto[]> {
    const entitlementIds = [
      ...new Set(params.uses.map((item) => item.entitlementId)),
    ];
    const entitlements = await this.prisma.benefitEntitlement.findMany({
      where: { id: { in: entitlementIds } },
      include: {
        procedures: {
          include: { procedure: { select: { id: true, specialtyId: true } } },
        },
        subscription: { include: { dependents: true } },
      },
    });
    if (entitlements.length !== entitlementIds.length) {
      const found = new Set(entitlements.map((item) => item.id));
      const missing = entitlementIds.find((id) => !found.has(id));
      throw new NotFoundException(`Benefit entitlement ${missing} not found`);
    }

    const byId = new Map(entitlements.map((item) => [item.id, item]));
    const onDate = ymdToUtcDate(params.onYmd);
    const proceduresForProfessional: Array<{
      id: number;
      specialtyId: number;
    }> = [];

    for (const use of params.uses) {
      const entitlement = byId.get(use.entitlementId);
      if (!entitlement) {
        throw new NotFoundException(
          `Benefit entitlement ${use.entitlementId} not found`,
        );
      }
      if (entitlement.kind !== BenefitKind.quota) {
        throw new BadRequestException(
          `Benefit entitlement ${entitlement.id} is not a quota`,
        );
      }
      const covered = entitlement.procedures.find(
        (item) => item.procedureId === use.procedureId,
      );
      if (!covered) {
        throw new BadRequestException(
          `Procedure ${use.procedureId} is not covered by benefit entitlement ${entitlement.id}`,
        );
      }
      const subscription = entitlement.subscription;
      const isMember =
        subscription.patientId === params.patientId ||
        subscription.dependents.some(
          (item) => item.patientId === params.patientId,
        );
      const current =
        subscription.status === BenefitSubscriptionStatus.active &&
        subscription.startsAt <= onDate &&
        subscription.expiresAt >= onDate;
      if (!isMember || !current) {
        throw new BadRequestException(
          `Benefit entitlement ${entitlement.id} is not available for patient ${params.patientId}`,
        );
      }
      proceduresForProfessional.push(covered.procedure);
    }

    await this.ensureProceduresMatchProfessional(
      params.healthProfessionalId,
      proceduresForProfessional,
    );

    const reservedById = await this.reservedBenefitQuantities(
      entitlementIds,
      params.excludeAppointmentId,
    );
    const requested = new Map<number, number>();
    for (const use of params.uses) {
      requested.set(
        use.entitlementId,
        (requested.get(use.entitlementId) ?? 0) + 1,
      );
    }
    for (const [entitlementId, count] of requested) {
      const entitlement = byId.get(entitlementId);
      if (!entitlement || entitlement.quantity == null) {
        throw new BadRequestException(
          `Benefit entitlement ${entitlementId} has no quantity`,
        );
      }
      const reserved = params.consumeNow
        ? 0
        : (reservedById.get(entitlementId) ?? 0);
      const remaining =
        entitlement.quantity - entitlement.usedQuantity - reserved;
      if (count > remaining) {
        throw new BadRequestException(
          `Benefit entitlement ${entitlementId} has no remaining quantity`,
        );
      }
    }

    return params.uses;
  }

  private async reservedBenefitQuantities(
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

  private async reservedPackageQuantities(
    itemIds: number[],
    excludeAppointmentId?: number,
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (itemIds.length === 0) {
      return map;
    }

    const grouped = await this.prisma.clinicalAppointmentProcedure.groupBy({
      by: ['patientPackageItemId'],
      where: {
        origin: ClinicalAppointmentProcedureOrigin.package,
        patientPackageItemId: { in: itemIds },
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
      if (row.patientPackageItemId != null) {
        map.set(row.patientPackageItemId, row._count._all);
      }
    }
    return map;
  }

  private async loadAndValidateGuides(params: {
    insuranceGuideIds: number[];
    patientId: number;
    healthProfessionalId: number;
    alreadyAssociatedIds?: number[];
  }): Promise<GuideForAppointment[]> {
    const alreadyAssociated = new Set(params.alreadyAssociatedIds ?? []);
    const guides = await this.prisma.insuranceGuide.findMany({
      where: { id: { in: params.insuranceGuideIds } },
      include: guideForAppointmentInclude,
    });

    if (guides.length !== params.insuranceGuideIds.length) {
      const found = new Set(guides.map((guide) => guide.id));
      const missing = params.insuranceGuideIds.find((id) => !found.has(id));
      throw new NotFoundException(`Insurance guide ${missing} not found`);
    }

    for (const guide of guides) {
      if (guide.patientId !== params.patientId) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} does not belong to patient ${params.patientId}`,
        );
      }

      if (guide.healthProfessionalId !== params.healthProfessionalId) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} does not belong to health professional ${params.healthProfessionalId}`,
        );
      }

      const isNewAssociation = !alreadyAssociated.has(guide.id);

      if (isNewAssociation && guide.isBilled) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} is already billed`,
        );
      }

      if (isNewAssociation && guide.billingBatchGuide) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} is already in a billing batch`,
        );
      }

      if (guide.procedures.length === 0) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} has no procedures`,
        );
      }
    }

    return guides.sort((a, b) => a.id - b.id);
  }

  private async consumeGuides(
    tx: Prisma.TransactionClient,
    guides: GuideForAppointment[],
  ) {
    for (const guide of guides) {
      await this.consumeGuideProcedures(
        tx,
        guide.id,
        guide.procedures.map((item) => item.procedureId),
      );
    }
  }

  private async releaseGuides(
    tx: Prisma.TransactionClient,
    guides: Array<{ id: number; procedures: Array<{ procedureId: number }> }>,
  ) {
    for (const guide of guides) {
      await this.releaseGuideProcedures(
        tx,
        guide.id,
        guide.procedures.map((item) => item.procedureId),
      );
    }
  }

  private async consumeGuideProcedures(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    procedureIds: number[],
  ) {
    for (const procedureId of procedureIds) {
      const rows = await tx.$executeRaw`
        UPDATE "insurance_guide_procedures"
        SET "used_quantity" = "used_quantity" + 1
        WHERE "insurance_guide_id" = ${insuranceGuideId}
          AND "procedure_id" = ${procedureId}
          AND "used_quantity" < "authorized_quantity"
      `;

      if (rows === 0) {
        throw new BadRequestException(
          `Procedure ${procedureId} has no remaining quantity on insurance guide ${insuranceGuideId}`,
        );
      }
    }
  }

  private async releaseGuideProcedures(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    procedureIds: number[],
  ) {
    for (const procedureId of procedureIds) {
      await tx.$executeRaw`
        UPDATE "insurance_guide_procedures"
        SET "used_quantity" = "used_quantity" - 1
        WHERE "insurance_guide_id" = ${insuranceGuideId}
          AND "procedure_id" = ${procedureId}
          AND "used_quantity" > 0
      `;
    }
  }

  private async consumePackageItems(
    tx: Prisma.TransactionClient,
    itemIds: number[],
  ) {
    const packageIds = new Set<number>();
    for (const itemId of itemIds) {
      const rows = await tx.$executeRaw`
        UPDATE "patient_package_items"
        SET "used_quantity" = "used_quantity" + 1
        WHERE "id" = ${itemId}
          AND "used_quantity" < "quantity"
      `;
      if (rows === 0) {
        throw new BadRequestException(
          `Patient package item ${itemId} has no remaining quantity`,
        );
      }
      const item = await tx.patientPackageItem.findUnique({
        where: { id: itemId },
        select: { patientPackageId: true },
      });
      if (item) {
        packageIds.add(item.patientPackageId);
      }
    }
    for (const patientPackageId of packageIds) {
      await this.refreshPatientPackageStatus(tx, patientPackageId);
    }
  }

  private async releasePackageItems(
    tx: Prisma.TransactionClient,
    itemIds: number[],
  ) {
    const packageIds = new Set<number>();
    for (const itemId of itemIds) {
      await tx.$executeRaw`
        UPDATE "patient_package_items"
        SET "used_quantity" = "used_quantity" - 1
        WHERE "id" = ${itemId}
          AND "used_quantity" > 0
      `;
      const item = await tx.patientPackageItem.findUnique({
        where: { id: itemId },
        select: { patientPackageId: true },
      });
      if (item) {
        packageIds.add(item.patientPackageId);
      }
    }
    for (const patientPackageId of packageIds) {
      await this.refreshPatientPackageStatus(tx, patientPackageId);
    }
  }

  private async consumeBenefitEntitlements(
    tx: Prisma.TransactionClient,
    entitlementIds: number[],
  ) {
    for (const entitlementId of entitlementIds) {
      const rows = await tx.$executeRaw`
        UPDATE "benefit_entitlements"
        SET "used_quantity" = "used_quantity" + 1
        WHERE "id" = ${entitlementId}
          AND "quantity" IS NOT NULL
          AND "used_quantity" < "quantity"
      `;
      if (rows === 0) {
        throw new BadRequestException(
          `Benefit entitlement ${entitlementId} has no remaining quantity`,
        );
      }
    }
  }

  private async releaseBenefitEntitlements(
    tx: Prisma.TransactionClient,
    entitlementIds: number[],
  ) {
    for (const entitlementId of entitlementIds) {
      await tx.$executeRaw`
        UPDATE "benefit_entitlements"
        SET "used_quantity" = "used_quantity" - 1
        WHERE "id" = ${entitlementId}
          AND "used_quantity" > 0
      `;
    }
  }

  private async refreshPatientPackageStatus(
    tx: Prisma.TransactionClient,
    patientPackageId: number,
  ) {
    const record = await tx.patientPackage.findUnique({
      where: { id: patientPackageId },
      include: { items: true },
    });
    if (!record || record.status === PatientPackageStatus.cancelled) {
      return;
    }
    const exhausted =
      record.items.length > 0 &&
      record.items.every((item) => item.usedQuantity >= item.quantity);
    const next = exhausted
      ? PatientPackageStatus.exhausted
      : PatientPackageStatus.active;
    if (record.status !== next) {
      await tx.patientPackage.update({
        where: { id: patientPackageId },
        data: { status: next },
      });
    }
  }

  private async ensurePatientExists(patientId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
  }

  private async ensureHealthProfessionalExists(healthProfessionalId: number) {
    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id: healthProfessionalId },
    });

    if (!professional) {
      throw new NotFoundException(
        `Health professional ${healthProfessionalId} not found`,
      );
    }
  }
}

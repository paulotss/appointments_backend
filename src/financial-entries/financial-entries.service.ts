import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalAppointmentProcedureOrigin,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  FinancialEntryStatus,
  FinancialEntryType,
  Prisma,
} from '@prisma/client';
import {
  computeChargedAmount,
  decimalToNumber,
  MoneyError,
  percentOfAmount,
} from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import { BenefitSubscriptionsService } from '../benefit-subscriptions/benefit-subscriptions.service';
import { ymdToUtcDate } from '../benefit-subscriptions/installments';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
  todayYmdSaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import {
  CreatePrivateFinancialEntryDto,
  ListFinancialEntriesQueryDto,
  ReceiveBenefitInstallmentDto,
} from './dto/financial-entry.dto';

const financialEntryInclude = {
  items: { include: { procedure: true } },
  clinicalAppointment: {
    include: { patient: true, healthProfessional: true },
  },
  billingBatch: { include: { healthPlan: true } },
  patientPackage: {
    include: { patient: true, package: true },
  },
  benefitSubscription: {
    include: { patient: true, plan: true },
  },
} as const;

@Injectable()
export class FinancialEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly benefitSubscriptionsService: BenefitSubscriptionsService,
  ) {}

  async createPrivateEntry(dto: CreatePrivateFinancialEntryDto) {
    const appointment = await this.prisma.clinicalAppointment.findUnique({
      where: { id: dto.clinicalAppointmentId },
      include: {
        financialEntry: true,
        procedures: { include: { procedure: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException(
        `Clinical appointment ${dto.clinicalAppointmentId} not found`,
      );
    }
    if (
      appointment.type !== ClinicalAppointmentType.private &&
      appointment.type !== ClinicalAppointmentType.mixed
    ) {
      throw new BadRequestException(
        'Financial entry of private procedures requires a private or mixed clinical appointment',
      );
    }
    if (appointment.status !== ClinicalAppointmentStatus.finished) {
      throw new BadRequestException(
        'Clinical appointment must be finished to register payment',
      );
    }
    if (appointment.financialEntry) {
      throw new BadRequestException(
        `Clinical appointment ${appointment.id} already has a financial entry`,
      );
    }

    const privateProcedures = appointment.procedures.filter(
      (item) => item.origin === ClinicalAppointmentProcedureOrigin.private,
    );
    if (privateProcedures.length === 0) {
      throw new BadRequestException(
        'Clinical appointment has no private procedures to bill',
      );
    }

    const items = privateProcedures.map((item) => ({
      procedureId: item.procedureId,
      quantity: 1,
      unitValue: decimalToNumber(item.procedure.value),
      description: item.procedure.name,
    }));

    const grossAmount = items.reduce(
      (sum, item) => sum + item.unitValue * item.quantity,
      0,
    );

    let discountAmount = dto.discountAmount;
    if (discountAmount === undefined) {
      const percent =
        await this.benefitSubscriptionsService.currentDiscountPercent(
          appointment.patientId,
          todayYmdSaoPaulo(),
        );
      discountAmount = percent > 0 ? percentOfAmount(grossAmount, percent) : 0;
    }

    let charged: ReturnType<typeof computeChargedAmount>;
    try {
      charged = computeChargedAmount({
        grossAmount,
        discountAmount,
        surchargeAmount: dto.surchargeAmount,
      });
    } catch (error) {
      if (error instanceof MoneyError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    return this.prisma.financialEntry.create({
      data: {
        type: FinancialEntryType.private_procedure,
        status: FinancialEntryStatus.paid,
        grossAmount: charged.grossAmount,
        discountAmount: charged.discountAmount,
        surchargeAmount: charged.surchargeAmount,
        amount: charged.amount,
        receivedAmount: charged.amount,
        paymentMethod: dto.paymentMethod,
        paidAt,
        notes: dto.notes,
        clinicalAppointmentId: appointment.id,
        items: { create: items },
      },
      include: financialEntryInclude,
    });
  }

  async findAll(query: ListFinancialEntriesQueryDto): Promise<
    ListEnvelope<
      Prisma.FinancialEntryGetPayload<{
        include: typeof financialEntryInclude;
      }>,
      { amount: number; receivedAmount: number }
    >
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const createdAt =
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
    const dueDate =
      query.from !== undefined || query.to !== undefined
        ? {
            ...(query.from !== undefined && {
              gte: ymdToUtcDate(query.from.slice(0, 10)),
            }),
            ...(query.to !== undefined && {
              lte: ymdToUtcDate(query.to.slice(0, 10)),
            }),
          }
        : undefined;

    const dateFilter: Prisma.FinancialEntryWhereInput =
      createdAt === undefined
        ? {}
        : query.type === FinancialEntryType.benefit_subscription
          ? { dueDate }
          : query.type !== undefined
            ? { createdAt }
            : {
                OR: [
                  {
                    type: { not: FinancialEntryType.benefit_subscription },
                    createdAt,
                  },
                  {
                    type: FinancialEntryType.benefit_subscription,
                    dueDate,
                  },
                ],
              };

    const where: Prisma.FinancialEntryWhereInput = {
      ...(query.type !== undefined && { type: query.type }),
      ...(query.status !== undefined && { status: query.status }),
      ...dateFilter,
    };

    const [data, total, sums] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        include: financialEntryInclude,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financialEntry.count({ where }),
      this.prisma.financialEntry.aggregate({
        where,
        _sum: { amount: true, receivedAmount: true },
      }),
    ]);

    return {
      data,
      meta: buildListMeta(page, limit, total),
      counts: {
        amount: decimalToNumber(sums._sum.amount ?? 0),
        receivedAmount: decimalToNumber(sums._sum.receivedAmount ?? 0),
      },
    };
  }

  async findOne(id: number) {
    const entry = await this.prisma.financialEntry.findUnique({
      where: { id },
      include: financialEntryInclude,
    });
    if (!entry) {
      throw new NotFoundException(`Financial entry ${id} not found`);
    }
    return entry;
  }

  async receiveBenefitInstallment(
    id: number,
    dto: ReceiveBenefitInstallmentDto,
  ) {
    const entry = await this.findOne(id);
    if (entry.type !== FinancialEntryType.benefit_subscription) {
      throw new BadRequestException(
        'Only benefit subscription entries can be received here',
      );
    }
    if (entry.status !== FinancialEntryStatus.pending) {
      throw new BadRequestException(`Financial entry ${id} is not pending`);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        status: FinancialEntryStatus.paid,
        receivedAmount: entry.amount,
        paymentMethod: dto.paymentMethod,
        paidAt,
      },
      include: financialEntryInclude,
    });
  }
}

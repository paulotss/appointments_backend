import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  FinancialEntryStatus,
  FinancialEntryType,
  Prisma,
} from '@prisma/client';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import {
  computeChargedAmount,
  decimalToNumber,
  MoneyError,
} from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePrivateFinancialEntryDto,
  ListFinancialEntriesQueryDto,
} from './dto/financial-entry.dto';

const financialEntryInclude = {
  items: { include: { procedure: true } },
  clinicalAppointment: {
    include: { patient: true, healthProfessional: true },
  },
  billingBatch: { include: { healthPlan: true } },
} as const;

@Injectable()
export class FinancialEntriesService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (appointment.type !== ClinicalAppointmentType.private) {
      throw new BadRequestException(
        'Financial entry of private procedures requires a private clinical appointment',
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
    if (appointment.procedures.length === 0) {
      throw new BadRequestException(
        'Clinical appointment has no procedures to bill',
      );
    }

    const items = appointment.procedures.map((item) => ({
      procedureId: item.procedureId,
      quantity: 1,
      unitValue: decimalToNumber(item.procedure.value),
      description: item.procedure.name,
    }));

    const grossAmount = items.reduce(
      (sum, item) => sum + item.unitValue * item.quantity,
      0,
    );

    let charged: ReturnType<typeof computeChargedAmount>;
    try {
      charged = computeChargedAmount({
        grossAmount,
        discountAmount: dto.discountAmount,
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

  async findAll(
    query: ListFinancialEntriesQueryDto,
  ): Promise<
    ListEnvelope<
      Prisma.FinancialEntryGetPayload<{ include: typeof financialEntryInclude }>
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

    const where: Prisma.FinancialEntryWhereInput = {
      ...(query.type !== undefined && { type: query.type }),
      ...(query.status !== undefined && { status: query.status }),
      ...(createdAt !== undefined && { createdAt }),
    };

    const [data, total] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        include: financialEntryInclude,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    return { data, meta: buildListMeta(page, limit, total) };
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
}

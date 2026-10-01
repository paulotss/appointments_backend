import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalAppointmentProcedureOrigin,
  ClinicalAppointmentStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  PatientPackageStatus,
  Prisma,
} from '@prisma/client';
import {
  applyPercentDiscount,
  computeChargedAmount,
  decimalToNumber,
  MoneyError,
} from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientPackageDto } from './dto/create-patient-package.dto';
import { ListPatientPackagesQueryDto } from './dto/list-patient-packages-query.dto';

const STATUSES_THAT_RESERVE: ClinicalAppointmentStatus[] = [
  ClinicalAppointmentStatus.marked,
  ClinicalAppointmentStatus.confirmed,
  ClinicalAppointmentStatus.waiting,
  ClinicalAppointmentStatus.attended,
];

const patientPackageInclude = {
  patient: true,
  package: true,
  items: {
    include: { procedure: true },
    orderBy: { id: 'asc' as const },
  },
  financialEntry: {
    include: { items: true },
  },
} as const;

type PatientPackageRecord = Prisma.PatientPackageGetPayload<{
  include: typeof patientPackageInclude;
}>;

@Injectable()
export class PatientPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientPackageDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${dto.patientId} not found`);
    }

    const catalog = await this.prisma.procedurePackage.findUnique({
      where: { id: dto.packageId },
      include: {
        items: { include: { procedure: true } },
      },
    });
    if (!catalog) {
      throw new NotFoundException(`Procedure package ${dto.packageId} not found`);
    }
    if (!catalog.isActive) {
      throw new BadRequestException(
        `Procedure package ${dto.packageId} is inactive`,
      );
    }
    if (catalog.items.length === 0) {
      throw new BadRequestException(
        `Procedure package ${dto.packageId} has no items`,
      );
    }

    const discountPercent = decimalToNumber(catalog.discountPercent);
    const snapshotItems = catalog.items.map((item) => {
      const catalogValue = decimalToNumber(item.procedure.value);
      return {
        procedureId: item.procedureId,
        quantity: item.quantity,
        catalogValue,
        unitValue: applyPercentDiscount(catalogValue, discountPercent),
        description: item.procedure.name,
      };
    });

    const grossAmount = snapshotItems.reduce(
      (sum, item) => sum + item.catalogValue * item.quantity,
      0,
    );
    const prepaidAmount = snapshotItems.reduce(
      (sum, item) => sum + item.unitValue * item.quantity,
      0,
    );

    let charged: ReturnType<typeof computeChargedAmount>;
    try {
      charged = computeChargedAmount({
        grossAmount,
        discountAmount: grossAmount - prepaidAmount,
      });
    } catch (error) {
      if (error instanceof MoneyError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const assigned = await tx.patientPackage.create({
        data: {
          patientId: dto.patientId,
          packageId: dto.packageId,
          status: PatientPackageStatus.active,
          items: {
            create: snapshotItems.map((item) => ({
              procedureId: item.procedureId,
              quantity: item.quantity,
              usedQuantity: 0,
              unitValue: item.unitValue,
            })),
          },
        },
      });

      await tx.financialEntry.create({
        data: {
          type: FinancialEntryType.procedure_package,
          status: FinancialEntryStatus.paid,
          grossAmount: charged.grossAmount,
          discountAmount: charged.discountAmount,
          surchargeAmount: 0,
          amount: charged.amount,
          receivedAmount: charged.amount,
          paymentMethod: dto.paymentMethod,
          paidAt,
          notes: dto.notes,
          patientPackageId: assigned.id,
          items: {
            create: snapshotItems.map((item) => ({
              procedureId: item.procedureId,
              quantity: item.quantity,
              unitValue: item.unitValue,
              description: item.description,
            })),
          },
        },
      });

      return tx.patientPackage.findUniqueOrThrow({
        where: { id: assigned.id },
        include: patientPackageInclude,
      });
    });
  }

  async findAll(query: ListPatientPackagesQueryDto) {
    if (query.patientId === undefined) {
      throw new BadRequestException('patientId is required');
    }
    const records = await this.prisma.patientPackage.findMany({
      where: { patientId: query.patientId },
      orderBy: { id: 'desc' },
      include: patientPackageInclude,
    });
    return this.withRemaining(records, query.excludeAppointmentId);
  }

  async findOne(id: number, excludeAppointmentId?: number) {
    const record = await this.prisma.patientPackage.findUnique({
      where: { id },
      include: patientPackageInclude,
    });
    if (!record) {
      throw new NotFoundException(`Patient package ${id} not found`);
    }
    const [mapped] = await this.withRemaining([record], excludeAppointmentId);
    return mapped;
  }

  async cancel(id: number) {
    const record = await this.findOne(id);
    if (record.status === PatientPackageStatus.cancelled) {
      throw new BadRequestException(`Patient package ${id} is already cancelled`);
    }
    if (record.items.some((item) => item.usedQuantity > 0)) {
      throw new BadRequestException(
        `Patient package ${id} cannot be cancelled because it has used quantity`,
      );
    }

    return this.prisma.patientPackage.update({
      where: { id },
      data: { status: PatientPackageStatus.cancelled },
      include: patientPackageInclude,
    });
  }

  private async withRemaining(
    records: PatientPackageRecord[],
    excludeAppointmentId?: number,
  ) {
    const itemIds = records.flatMap((record) =>
      record.items.map((item) => item.id),
    );
    const reservedByItemId = await this.reservedQuantities(
      itemIds,
      excludeAppointmentId,
    );

    return records.map((record) => ({
      ...record,
      items: record.items.map((item) => {
        const reserved = reservedByItemId.get(item.id) ?? 0;
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

  private async reservedQuantities(
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
}

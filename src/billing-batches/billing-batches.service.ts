import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingBatchStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  Prisma,
} from '@prisma/client';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import {
  centsToMoney,
  computeGuideBilledAmountCents,
  decimalToNumber,
  entryStatusFromReceived,
  isGuideEligibleForBilling,
  MoneyError,
  moneyToCents,
} from '../finance/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBillingBatchDto,
  ListBillingBatchesQueryDto,
  ReceiveBillingBatchDto,
  UpdateBillingBatchDto,
} from './dto/billing-batch.dto';

const billingBatchInclude = {
  healthPlan: true,
  financialEntry: true,
  guides: {
    include: {
      insuranceGuide: {
        include: {
          patient: true,
          healthProfessional: true,
          procedures: { include: { procedure: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class BillingBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBillingBatchDto) {
    await this.ensureHealthPlanExists(dto.healthPlanId);
    const snapshots = await this.loadEligibleGuides(
      this.uniqueIds(dto.insuranceGuideIds),
      dto.healthPlanId,
    );

    return this.prisma.billingBatch.create({
      data: {
        healthPlanId: dto.healthPlanId,
        protocolNumber: dto.protocolNumber,
        billedAmount: centsToMoney(
          snapshots.reduce((sum, item) => sum + item.billedCents, 0),
        ),
        guides: {
          create: snapshots.map((item) => ({
            insuranceGuideId: item.id,
            billedAmount: centsToMoney(item.billedCents),
          })),
        },
      },
      include: billingBatchInclude,
    });
  }

  async findAll(
    query: ListBillingBatchesQueryDto,
  ): Promise<
    ListEnvelope<
      Prisma.BillingBatchGetPayload<{ include: typeof billingBatchInclude }>
    >
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.BillingBatchWhereInput = {
      ...(query.healthPlanId !== undefined && {
        healthPlanId: query.healthPlanId,
      }),
      ...(query.status !== undefined && { status: query.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.billingBatch.findMany({
        where,
        include: billingBatchInclude,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billingBatch.count({ where }),
    ]);

    return { data, meta: buildListMeta(page, limit, total) };
  }

  async findOne(id: number) {
    const batch = await this.prisma.billingBatch.findUnique({
      where: { id },
      include: billingBatchInclude,
    });
    if (!batch) {
      throw new NotFoundException(`Billing batch ${id} not found`);
    }
    return batch;
  }

  async update(id: number, dto: UpdateBillingBatchDto) {
    const batch = await this.findOne(id);
    if (batch.status !== BillingBatchStatus.open) {
      throw new BadRequestException('Only open billing batches can be updated');
    }

    const currentIds = new Set(
      batch.guides.map((item) => item.insuranceGuideId),
    );
    const removeIds = new Set(dto.removeInsuranceGuideIds ?? []);
    const addIds = this.uniqueIds(dto.addInsuranceGuideIds ?? []).filter(
      (guideId) => !currentIds.has(guideId) && !removeIds.has(guideId),
    );

    if (
      addIds.length === 0 &&
      removeIds.size === 0 &&
      dto.protocolNumber === undefined
    ) {
      return batch;
    }

    const remaining = batch.guides.filter(
      (item) => !removeIds.has(item.insuranceGuideId),
    );
    const addSnapshots =
      addIds.length > 0
        ? await this.loadEligibleGuides(addIds, batch.healthPlanId)
        : [];
    const billedCents =
      remaining.reduce(
        (sum, item) => sum + moneyToCents(decimalToNumber(item.billedAmount)),
        0,
      ) + addSnapshots.reduce((sum, item) => sum + item.billedCents, 0);

    return this.prisma.$transaction(async (tx) => {
      if (removeIds.size > 0) {
        await tx.billingBatchGuide.deleteMany({
          where: {
            billingBatchId: id,
            insuranceGuideId: { in: [...removeIds] },
          },
        });
      }
      if (addSnapshots.length > 0) {
        await tx.billingBatchGuide.createMany({
          data: addSnapshots.map((item) => ({
            billingBatchId: id,
            insuranceGuideId: item.id,
            billedAmount: centsToMoney(item.billedCents),
          })),
        });
      }
      return tx.billingBatch.update({
        where: { id },
        data: {
          billedAmount: centsToMoney(billedCents),
          ...(dto.protocolNumber !== undefined && {
            protocolNumber: dto.protocolNumber,
          }),
        },
        include: billingBatchInclude,
      });
    });
  }

  async bill(id: number) {
    const batch = await this.findOne(id);
    if (batch.status !== BillingBatchStatus.open) {
      throw new BadRequestException('Only open billing batches can be billed');
    }
    if (batch.guides.length === 0) {
      throw new BadRequestException('Cannot bill a batch without guides');
    }

    const billedAmount = decimalToNumber(batch.billedAmount);
    if (billedAmount <= 0) {
      throw new BadRequestException('Cannot bill a batch with zero amount');
    }

    const guideIds = batch.guides.map((item) => item.insuranceGuideId);

    await this.prisma.$transaction(async (tx) => {
      await tx.insuranceGuide.updateMany({
        where: { id: { in: guideIds } },
        data: { isBilled: true },
      });
      await tx.financialEntry.create({
        data: {
          type: FinancialEntryType.health_plan,
          status: FinancialEntryStatus.pending,
          grossAmount: billedAmount,
          amount: billedAmount,
          receivedAmount: 0,
          billingBatchId: id,
        },
      });
      await tx.billingBatch.update({
        where: { id },
        data: {
          status: BillingBatchStatus.billed,
          billedAt: new Date(),
        },
      });
    });

    return this.findOne(id);
  }

  async receive(id: number, dto: ReceiveBillingBatchDto) {
    const batch = await this.findOne(id);
    if (batch.status !== BillingBatchStatus.billed) {
      throw new BadRequestException('Only billed batches can receive payment');
    }
    if (
      !batch.financialEntry ||
      batch.financialEntry.status === FinancialEntryStatus.cancelled
    ) {
      throw new BadRequestException(
        `Billing batch ${id} has no pending financial entry`,
      );
    }

    let nextStatus: FinancialEntryStatus;
    try {
      nextStatus =
        entryStatusFromReceived(
          moneyToCents(decimalToNumber(batch.billedAmount)),
          moneyToCents(dto.receivedAmount),
        ) === 'paid'
          ? FinancialEntryStatus.paid
          : FinancialEntryStatus.partially_paid;
    } catch (error) {
      if (error instanceof MoneyError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const guideIds = new Set(batch.guides.map((item) => item.insuranceGuideId));
    if (dto.items) {
      for (const item of dto.items) {
        if (!guideIds.has(item.insuranceGuideId)) {
          throw new BadRequestException(
            `Insurance guide ${item.insuranceGuideId} is not in billing batch ${id}`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        for (const item of dto.items) {
          await tx.billingBatchGuide.update({
            where: { insuranceGuideId: item.insuranceGuideId },
            data: {
              receivedAmount: item.receivedAmount,
              glosaReason: item.glosaReason,
            },
          });
        }
      }

      await tx.financialEntry.update({
        where: { id: batch.financialEntry!.id },
        data: {
          status: nextStatus,
          receivedAmount: dto.receivedAmount,
          paymentMethod: dto.paymentMethod,
          paidAt,
        },
      });

      return tx.billingBatch.update({
        where: { id },
        data: {
          status: BillingBatchStatus.settled,
          receivedAmount: dto.receivedAmount,
          settledAt: paidAt,
        },
        include: billingBatchInclude,
      });
    });
  }

  async cancel(id: number) {
    const batch = await this.findOne(id);

    if (batch.status === BillingBatchStatus.settled) {
      throw new BadRequestException(
        'Settled billing batches cannot be cancelled',
      );
    }
    if (batch.status === BillingBatchStatus.cancelled) {
      throw new BadRequestException('Billing batch is already cancelled');
    }

    if (batch.status === BillingBatchStatus.open) {
      return this.prisma.$transaction(async (tx) => {
        await tx.billingBatchGuide.deleteMany({
          where: { billingBatchId: id },
        });
        return tx.billingBatch.update({
          where: { id },
          data: { status: BillingBatchStatus.cancelled, billedAmount: 0 },
          include: billingBatchInclude,
        });
      });
    }

    const entryStatus = batch.financialEntry?.status;
    if (
      entryStatus &&
      entryStatus !== FinancialEntryStatus.pending &&
      entryStatus !== FinancialEntryStatus.cancelled
    ) {
      throw new BadRequestException(
        'Cannot cancel a billed batch after payment was received',
      );
    }

    const guideIds = batch.guides.map((item) => item.insuranceGuideId);

    return this.prisma.$transaction(async (tx) => {
      await tx.insuranceGuide.updateMany({
        where: { id: { in: guideIds } },
        data: { isBilled: false },
      });
      if (batch.financialEntry) {
        await tx.financialEntry.update({
          where: { id: batch.financialEntry.id },
          data: { status: FinancialEntryStatus.cancelled },
        });
      }
      await tx.billingBatchGuide.deleteMany({ where: { billingBatchId: id } });
      return tx.billingBatch.update({
        where: { id },
        data: { status: BillingBatchStatus.cancelled },
        include: billingBatchInclude,
      });
    });
  }

  private uniqueIds(ids: number[]): number[] {
    return [...new Set(ids)];
  }

  private async ensureHealthPlanExists(healthPlanId: number) {
    const healthPlan = await this.prisma.healthPlan.findUnique({
      where: { id: healthPlanId },
    });
    if (!healthPlan) {
      throw new NotFoundException(`Health plan ${healthPlanId} not found`);
    }
  }

  private async loadEligibleGuides(
    insuranceGuideIds: number[],
    healthPlanId: number,
  ): Promise<Array<{ id: number; billedCents: number }>> {
    const guides = await this.prisma.insuranceGuide.findMany({
      where: { id: { in: insuranceGuideIds } },
      include: {
        procedures: true,
        billingBatchGuide: { select: { billingBatchId: true } },
      },
    });

    if (guides.length !== insuranceGuideIds.length) {
      const found = new Set(guides.map((guide) => guide.id));
      const missing = insuranceGuideIds.find((id) => !found.has(id));
      throw new NotFoundException(`Insurance guide ${missing} not found`);
    }

    return guides.map((guide) => {
      if (guide.healthPlanId !== healthPlanId) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} does not belong to health plan ${healthPlanId}`,
        );
      }
      if (
        !isGuideEligibleForBilling({
          isBilled: guide.isBilled,
          inBillingBatch: guide.billingBatchGuide !== null,
          procedures: guide.procedures.map((item) => ({
            usedQuantity: item.usedQuantity,
          })),
        })
      ) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} is not eligible for billing`,
        );
      }
      return {
        id: guide.id,
        billedCents: computeGuideBilledAmountCents(
          guide.procedures.map((item) => ({
            value: decimalToNumber(item.value),
            usedQuantity: item.usedQuantity,
          })),
        ),
      };
    });
  }
}

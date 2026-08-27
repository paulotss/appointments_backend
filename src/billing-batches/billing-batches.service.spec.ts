/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BillingBatchStatus,
  FinancialEntryStatus,
  FinancialEntryType,
} from '@prisma/client';
import { BillingBatchesService } from './billing-batches.service';

describe('BillingBatchesService.billGuide', () => {
  const tx = {
    billingBatch: { create: jest.fn() },
    insuranceGuide: { update: jest.fn() },
    financialEntry: { create: jest.fn() },
  };
  const prisma = {
    insuranceGuide: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    billingBatch: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new BillingBatchesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<number>) => callback(tx),
    );
  });

  it('rejects a missing guide', async () => {
    prisma.insuranceGuide.findUnique.mockResolvedValue(null);

    await expect(service.billGuide(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a guide that is not eligible for billing', async () => {
    prisma.insuranceGuide.findUnique.mockResolvedValue({
      id: 1,
      healthPlanId: 2,
    });
    prisma.insuranceGuide.findMany.mockResolvedValue([
      {
        id: 1,
        healthPlanId: 2,
        isBilled: true,
        billingBatchGuide: null,
        procedures: [{ usedQuantity: 1, value: 100 }],
      },
    ]);

    await expect(service.billGuide(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a guide already in a billing batch', async () => {
    prisma.insuranceGuide.findUnique.mockResolvedValue({
      id: 4,
      healthPlanId: 2,
    });
    prisma.insuranceGuide.findMany.mockResolvedValue([
      {
        id: 4,
        healthPlanId: 2,
        isBilled: false,
        billingBatchGuide: { billingBatchId: 8 },
        procedures: [{ usedQuantity: 1, value: 50 }],
      },
    ]);

    await expect(service.billGuide(4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a billed batch, marks the guide and a pending financial entry', async () => {
    prisma.insuranceGuide.findUnique.mockResolvedValue({
      id: 7,
      healthPlanId: 3,
    });
    prisma.insuranceGuide.findMany.mockResolvedValue([
      {
        id: 7,
        healthPlanId: 3,
        isBilled: false,
        billingBatchGuide: null,
        procedures: [{ usedQuantity: 2, value: 80.5 }],
      },
    ]);
    tx.billingBatch.create.mockResolvedValue({ id: 11 });
    prisma.billingBatch.findUnique.mockResolvedValue({ id: 11 });

    const result = await service.billGuide(7);

    expect(result).toEqual({ id: 11 });
    expect(tx.billingBatch.create).toHaveBeenCalledWith({
      data: {
        healthPlanId: 3,
        billedAmount: 161,
        status: BillingBatchStatus.billed,
        billedAt: expect.any(Date),
        guides: {
          create: {
            insuranceGuideId: 7,
            billedAmount: 161,
          },
        },
      },
    });
    expect(tx.insuranceGuide.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isBilled: true },
    });
    expect(tx.financialEntry.create).toHaveBeenCalledWith({
      data: {
        type: FinancialEntryType.health_plan,
        status: FinancialEntryStatus.pending,
        grossAmount: 161,
        amount: 161,
        receivedAmount: 0,
        billingBatchId: 11,
      },
    });
  });
});

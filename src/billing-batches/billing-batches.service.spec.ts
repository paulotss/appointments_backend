/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BillingBatchStatus,
  FinancialEntryStatus,
  FinancialEntryType,
} from '@prisma/client';
import { buildBatchNumber } from './billing-batch-number';
import { BillingBatchesService } from './billing-batches.service';

describe('buildBatchNumber', () => {
  it('combines id and UTC creation date', () => {
    expect(buildBatchNumber(15, new Date('2026-09-01T18:30:00.000Z'))).toBe(
      '15-20260901',
    );
  });
});

describe('BillingBatchesService.create', () => {
  const tx = {
    billingBatch: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    healthPlan: { findUnique: jest.fn() },
    insuranceGuide: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new BillingBatchesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
  });

  it('creates an open batch and assigns batchNumber from id and createdAt', async () => {
    prisma.healthPlan.findUnique.mockResolvedValue({ id: 3 });
    prisma.insuranceGuide.findMany.mockResolvedValue([
      {
        id: 7,
        healthPlanId: 3,
        isBilled: false,
        billingBatchGuide: null,
        procedures: [{ usedQuantity: 2, value: 80.5 }],
      },
    ]);
    const createdAt = new Date('2026-09-01T12:00:00.000Z');
    tx.billingBatch.create.mockResolvedValue({ id: 15, createdAt });
    tx.billingBatch.update.mockResolvedValue({
      id: 15,
      batchNumber: '15-20260901',
    });

    const result = await service.create({
      healthPlanId: 3,
      insuranceGuideIds: [7],
    });

    expect(result).toEqual({ id: 15, batchNumber: '15-20260901' });
    expect(tx.billingBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          healthPlanId: 3,
          billedAmount: 161,
          batchNumber: expect.any(String),
        }),
      }),
    );
    expect(tx.billingBatch.update).toHaveBeenCalledWith({
      where: { id: 15 },
      data: { batchNumber: '15-20260901' },
      include: expect.any(Object),
    });
  });
});

describe('BillingBatchesService.billGuide', () => {
  const tx = {
    billingBatch: { create: jest.fn(), update: jest.fn() },
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
    const createdAt = new Date('2026-09-01T12:00:00.000Z');
    tx.billingBatch.create.mockResolvedValue({ id: 11, createdAt });
    prisma.billingBatch.findUnique.mockResolvedValue({
      id: 11,
      batchNumber: '11-20260901',
    });

    const result = await service.billGuide(7);

    expect(result).toEqual({ id: 11, batchNumber: '11-20260901' });
    expect(tx.billingBatch.create).toHaveBeenCalledWith({
      data: {
        healthPlanId: 3,
        billedAmount: 161,
        status: BillingBatchStatus.billed,
        billedAt: expect.any(Date),
        batchNumber: expect.any(String),
        guides: {
          create: {
            insuranceGuideId: 7,
            billedAmount: 161,
          },
        },
      },
    });
    expect(tx.billingBatch.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { batchNumber: '11-20260901' },
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

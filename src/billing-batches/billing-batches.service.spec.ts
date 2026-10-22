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
  const service = new BillingBatchesService(prisma as never, {} as never);

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
  const service = new BillingBatchesService(prisma as never, {} as never);

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

describe('BillingBatchesService.exportGuideDocuments', () => {
  const prisma = {
    billingBatch: { findUnique: jest.fn() },
    insuranceGuideDocument: { findMany: jest.fn() },
  };
  const fileStorage = { getBuffer: jest.fn() };
  const service = new BillingBatchesService(
    prisma as never,
    fileStorage as never,
  );
  const batch = {
    id: 28,
    batchNumber: '28-20261021',
    guides: [
      {
        insuranceGuideId: 7,
        insuranceGuide: {
          id: 7,
          guideNumber: '421715',
          patient: { name: 'Maria Silva' },
        },
      },
      {
        insuranceGuideId: 9,
        insuranceGuide: {
          id: 9,
          guideNumber: null,
          patient: { name: 'João Souza' },
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('names each guide whose image is missing in storage', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue(batch);
    prisma.insuranceGuideDocument.findMany.mockResolvedValue([
      {
        id: 1,
        insuranceGuideId: 7,
        originalName: 'a.jpg',
        storageKey: 'guides/7/a.jpg',
      },
      {
        id: 2,
        insuranceGuideId: 7,
        originalName: 'a2.jpg',
        storageKey: 'guides/7/a2.jpg',
      },
      {
        id: 3,
        insuranceGuideId: 9,
        originalName: 'b.jpg',
        storageKey: 'guides/9/b.jpg',
      },
    ]);
    fileStorage.getBuffer.mockRejectedValue(
      Object.assign(new Error('The specified key does not exist.'), {
        name: 'NoSuchKey',
        Code: 'NoSuchKey',
      }),
    );

    await expect(service.exportGuideDocuments(28)).rejects.toThrow(
      new BadRequestException(
        [
          'A imagem não foi encontrada nestas guias:',
          '- guia 421715 (Maria Silva)',
          '- guia 9 (João Souza)',
          'Envie as imagens novamente nessas guias.',
        ].join('\n'),
      ),
    );
  });

  it('names a single guide when only one image is missing', async () => {
    prisma.billingBatch.findUnique.mockResolvedValue(batch);
    prisma.insuranceGuideDocument.findMany.mockResolvedValue([
      {
        id: 1,
        insuranceGuideId: 7,
        originalName: 'a.jpg',
        storageKey: 'guides/7/a.jpg',
      },
    ]);
    fileStorage.getBuffer.mockRejectedValue(
      new NotFoundException('Object guides/7/a.jpg not found'),
    );

    await expect(service.exportGuideDocuments(28)).rejects.toThrow(
      new BadRequestException(
        'A imagem da guia 421715 (Maria Silva) não foi encontrada. Envie a imagem novamente nessa guia.',
      ),
    );
  });
});

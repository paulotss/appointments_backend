/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { PayableStatus, PaymentMethod } from '@prisma/client';
import { PayablesService } from './payables.service';

describe('PayablesService.pay', () => {
  const prisma = {
    payable: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financialExit: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const fileStorage = { remove: jest.fn() };
  const service = new PayablesService(prisma as never, fileStorage as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => Promise.resolve(fn(prisma)),
    );
  });

  it('rejects paying a payable that is not pending', async () => {
    prisma.payable.findUnique.mockResolvedValue({
      id: 1,
      status: PayableStatus.paid,
      documents: [],
      amount: 10,
    });

    await expect(
      service.pay(1, { paymentMethod: PaymentMethod.pix }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a financial exit when paying', async () => {
    const payable = {
      id: 2,
      status: PayableStatus.pending,
      amount: 99.9,
      documents: [],
    };
    prisma.payable.findUnique.mockResolvedValue(payable);
    prisma.financialExit.create.mockResolvedValue({ id: 8 });
    prisma.payable.update.mockResolvedValue({
      ...payable,
      status: PayableStatus.paid,
      financialExit: { id: 8 },
    });

    await service.pay(2, { paymentMethod: PaymentMethod.transfer });

    expect(prisma.financialExit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payableId: 2,
          paymentMethod: PaymentMethod.transfer,
        }),
      }),
    );
    expect(prisma.payable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayableStatus.paid }),
      }),
    );
  });
});

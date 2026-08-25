/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  FinancialEntryStatus,
  FinancialEntryType,
  PaymentMethod,
} from '@prisma/client';
import { FinancialEntriesService } from './financial-entries.service';

describe('FinancialEntriesService.createPrivateEntry', () => {
  const prisma = {
    clinicalAppointment: { findUnique: jest.fn() },
    financialEntry: { create: jest.fn() },
  };
  const service = new FinancialEntriesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects appointments that are not private and finished', async () => {
    prisma.clinicalAppointment.findUnique.mockResolvedValue(null);
    await expect(
      service.createPrivateEntry({
        clinicalAppointmentId: 1,
        paymentMethod: PaymentMethod.pix,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.clinicalAppointment.findUnique.mockResolvedValue({
      id: 1,
      type: ClinicalAppointmentType.health_plan,
      status: ClinicalAppointmentStatus.finished,
      financialEntry: null,
      procedures: [],
    });
    await expect(
      service.createPrivateEntry({
        clinicalAppointmentId: 1,
        paymentMethod: PaymentMethod.pix,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a paid entry with discount and surcharge snapshot', async () => {
    prisma.clinicalAppointment.findUnique.mockResolvedValue({
      id: 9,
      type: ClinicalAppointmentType.private,
      status: ClinicalAppointmentStatus.finished,
      financialEntry: null,
      procedures: [
        {
          procedureId: 3,
          procedure: { id: 3, name: 'Consulta', specialtyId: 1, value: 150 },
        },
      ],
    });
    prisma.financialEntry.create.mockResolvedValue({ id: 1 });

    await service.createPrivateEntry({
      clinicalAppointmentId: 9,
      paymentMethod: PaymentMethod.cash,
      discountAmount: 20,
      surchargeAmount: 5,
    });

    const data = prisma.financialEntry.create.mock.calls[0][0].data as {
      type: FinancialEntryType;
      status: FinancialEntryStatus;
      grossAmount: number;
      discountAmount: number;
      surchargeAmount: number;
      amount: number;
      receivedAmount: number;
      items: { create: unknown };
    };
    expect(data.type).toBe(FinancialEntryType.private_procedure);
    expect(data.status).toBe(FinancialEntryStatus.paid);
    expect(Number(data.grossAmount)).toBe(150);
    expect(Number(data.discountAmount)).toBe(20);
    expect(Number(data.surchargeAmount)).toBe(5);
    expect(Number(data.amount)).toBe(135);
    expect(Number(data.receivedAmount)).toBe(135);
    expect(data.items.create).toEqual([
      {
        procedureId: 3,
        quantity: 1,
        unitValue: 150,
        description: 'Consulta',
      },
    ]);
  });
});

import { NotFoundException } from '@nestjs/common';
import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@prisma/client';
import { todayYmdSaoPaulo } from '../common/datetime/sao-paulo-day-bounds';
import { AgentDataService } from './agent-data.service';

describe('AgentDataService', () => {
  const prisma = {
    clinicProfile: { findUnique: jest.fn() },
    patient: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    clinicalAppointment: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    appointment: { count: jest.fn() },
    insuranceGuide: { groupBy: jest.fn(), count: jest.fn() },
    financialEntry: { aggregate: jest.fn() },
    payable: { aggregate: jest.fn(), count: jest.fn() },
    product: { findMany: jest.fn() },
    stockBatch: { count: jest.fn() },
  };
  const service = new AgentDataService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a compact clinic overview', async () => {
    prisma.clinicProfile.findUnique.mockResolvedValue({
      legalName: 'Clinica Teste',
      cnpj: '123',
    });
    prisma.patient.count.mockResolvedValue(12);
    prisma.clinicalAppointment.groupBy.mockResolvedValue([
      { status: ClinicalAppointmentStatus.marked, _count: { _all: 3 } },
      { status: ClinicalAppointmentStatus.finished, _count: { _all: 1 } },
    ]);
    prisma.appointment.count.mockResolvedValue(4);
    prisma.insuranceGuide.groupBy.mockResolvedValue([
      { status: 'pending', _count: { _all: 2 } },
      { status: 'authorized', _count: { _all: 5 } },
    ]);
    prisma.insuranceGuide.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(7);
    prisma.financialEntry.aggregate.mockResolvedValue({
      _sum: { amount: 150.5 },
    });
    prisma.payable.aggregate.mockResolvedValue({ _sum: { amount: 80 } });
    prisma.payable.count.mockResolvedValue(2);
    prisma.product.findMany.mockResolvedValue([
      {
        minimumStock: 10,
        stockBatches: [{ currentQuantity: 4 }],
      },
      {
        minimumStock: 5,
        stockBatches: [{ currentQuantity: 8 }],
      },
    ]);
    prisma.stockBatch.count.mockResolvedValue(3);

    await expect(service.getOverview()).resolves.toEqual({
      clinic: { legalName: 'Clinica Teste', cnpj: '123' },
      today: {
        date: todayYmdSaoPaulo(),
        clinicalAppointmentsByStatus: {
          marked: 3,
          confirmed: 0,
          waiting: 0,
          attended: 0,
          finished: 1,
          absent: 0,
        },
        callCenterAppointments: 4,
      },
      patients: { total: 12 },
      guides: {
        pending: 2,
        under_analysis: 0,
        authorized: 5,
        expiringIn7Days: 1,
        unbilled: 7,
      },
      finance: {
        pendingEntriesAmount: 150.5,
        pendingPayablesAmount: 80,
        overduePayablesCount: 2,
      },
      stock: {
        productsBelowMinimum: 1,
        expiredBatches: 3,
      },
    });
  });

  it('searches patients by CPF digits', async () => {
    prisma.patient.findMany.mockResolvedValue([
      {
        id: 9,
        name: 'Maria',
        cpf: '12345678901',
        phone: '1199999',
        email: null,
        birthDate: null,
      },
    ]);
    prisma.patient.count.mockResolvedValue(1);

    const result = await service.searchPatients({
      q: '123.456.789-01',
      page: 1,
      limit: 10,
    });

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: '123.456.789-01', mode: 'insensitive' } },
            { phone: { contains: '123.456.789-01' } },
            { cpf: { contains: '12345678901' } },
          ],
        },
        take: 10,
        skip: 0,
      }),
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(result.data).toHaveLength(1);
  });

  it('lists compact clinical appointments with pagination', async () => {
    prisma.clinicalAppointment.findMany.mockResolvedValue([
      {
        id: 1,
        scheduledAt: new Date('2026-09-18T12:00:00.000Z'),
        endsAt: new Date('2026-09-18T12:30:00.000Z'),
        status: ClinicalAppointmentStatus.marked,
        type: ClinicalAppointmentType.private,
        patient: { id: 2, name: 'Ana' },
        healthProfessional: { id: 3, name: 'Dr. Joao' },
      },
    ]);
    prisma.clinicalAppointment.count.mockResolvedValue(21);

    const result = await service.listClinicalAppointments({
      from: '2026-09-18',
      to: '2026-09-18',
      page: 2,
      limit: 10,
    });

    expect(prisma.clinicalAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 1,
        patient: { id: 2, name: 'Ana' },
      }),
    );
  });

  it('throws when compact patient is missing', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);
    await expect(service.getPatient(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

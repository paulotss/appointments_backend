/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InsuranceGuidesService } from './insurance-guides.service';

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.5.0',
    meta: { target: ['guide_number'] },
  });
}

describe('InsuranceGuidesService guideNumber uniqueness', () => {
  const prisma = {
    healthPlan: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn() },
    healthProfessional: { findUnique: jest.fn() },
    procedure: { findMany: jest.fn() },
    healthProfessionalSpecialty: { findMany: jest.fn() },
    healthPlanProcedure: { findMany: jest.fn() },
    insuranceGuide: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new InsuranceGuidesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.healthPlan.findUnique.mockResolvedValue({
      id: 1,
      submissionDeadlineDays: 10,
    });
    prisma.patient.findUnique.mockResolvedValue({ id: 2 });
    prisma.healthProfessional.findUnique.mockResolvedValue({ id: 3 });
    prisma.procedure.findMany.mockResolvedValue([
      { id: 9, specialtyId: 4 },
    ]);
    prisma.healthProfessionalSpecialty.findMany.mockResolvedValue([
      { specialtyId: 4 },
    ]);
    prisma.healthPlanProcedure.findMany.mockResolvedValue([
      { procedureId: 9, value: 80 },
    ]);
  });

  it('rejects create when guideNumber already exists', async () => {
    prisma.insuranceGuide.create.mockRejectedValue(uniqueConstraintError());

    await expect(
      service.create({
        healthPlanId: 1,
        patientId: 2,
        healthProfessionalId: 3,
        guideNumber: 'ABC-1',
        procedures: [{ procedureId: 9, authorizedQuantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects update when guideNumber already exists', async () => {
    prisma.insuranceGuide.findUnique.mockResolvedValue({
      id: 10,
      healthPlanId: 1,
      patientId: 2,
      healthProfessionalId: 3,
      procedures: [
        { procedureId: 9, authorizedQuantity: 1, usedQuantity: 0 },
      ],
    });
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    prisma.insuranceGuide.update.mockRejectedValue(uniqueConstraintError());

    await expect(
      service.update(10, { guideNumber: 'ABC-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

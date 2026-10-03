import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GuideImportsService } from './guide-imports.service';

describe('GuideImportsService commit', () => {
  const vision = { extract: jest.fn() };
  const matcher = { match: jest.fn() };
  const prisma = {
    healthPlan: { findUnique: jest.fn() },
    healthProfessional: { findUnique: jest.fn() },
    procedure: { findMany: jest.fn() },
    healthPlanProcedure: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const insuranceGuidesService = { create: jest.fn() };
  const service = new GuideImportsService(
    vision,
    matcher as never,
    prisma as never,
    insuranceGuidesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects commit when the health plan is not registered', async () => {
    prisma.healthPlan.findUnique.mockResolvedValue(null);

    await expect(
      service.commit({
        healthPlanId: 99,
        healthProfessionalId: 1,
        procedures: [{ procedureId: 1, authorizedQuantity: 1 }],
        patient: { mode: 'existing', patientId: 1 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('forwards used quantity and the current user when committing', async () => {
    prisma.healthPlan.findUnique.mockResolvedValue({ id: 1 });
    prisma.healthProfessional.findUnique.mockResolvedValue({ id: 2 });
    prisma.procedure.findMany.mockResolvedValue([{ id: 9 }]);
    prisma.healthPlanProcedure.findMany.mockResolvedValue([{ procedureId: 9 }]);
    const tx = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 3,
          insuranceCards: [{ healthPlanId: 1 }],
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    insuranceGuidesService.create.mockResolvedValue({ id: 10 });

    await service.commit(
      {
        healthPlanId: 1,
        healthProfessionalId: 2,
        procedures: [{ procedureId: 9, authorizedQuantity: 8, usedQuantity: 8 }],
        patient: { mode: 'existing', patientId: 3 },
      },
      { role: UserRole.ADMIN },
    );

    expect(insuranceGuidesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 3,
        procedures: [{ procedureId: 9, authorizedQuantity: 8, usedQuantity: 8 }],
      }),
      tx,
      { role: UserRole.ADMIN },
    );
  });

  it('rejects analyze without a file', async () => {
    await expect(service.analyze(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

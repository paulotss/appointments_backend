import { BadRequestException } from '@nestjs/common';
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

  it('rejects analyze without a file', async () => {
    await expect(service.analyze(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

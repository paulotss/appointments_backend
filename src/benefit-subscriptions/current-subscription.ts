import { BenefitSubscriptionStatus, Prisma } from '@prisma/client';

export function currentSubscriptionWhere(
  patientId: number,
  onDate: Date,
): Prisma.BenefitSubscriptionWhereInput {
  return {
    status: BenefitSubscriptionStatus.active,
    startsAt: { lte: onDate },
    expiresAt: { gte: onDate },
    OR: [{ patientId }, { dependents: { some: { patientId } } }],
  };
}

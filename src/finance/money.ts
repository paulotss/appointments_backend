export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function moneyToCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError('Invalid monetary value');
  }
  return Math.round(value * 100);
}

export function centsToMoney(cents: number): number {
  return cents / 100;
}

export function decimalToNumber(
  value: { toNumber(): number } | number | string,
): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return value.toNumber();
}

export function computeChargedAmount(params: {
  grossAmount: number;
  discountAmount?: number;
  surchargeAmount?: number;
}): {
  grossAmount: number;
  discountAmount: number;
  surchargeAmount: number;
  amount: number;
} {
  const grossCents = moneyToCents(params.grossAmount);
  const discountCents = moneyToCents(params.discountAmount ?? 0);
  const surchargeCents = moneyToCents(params.surchargeAmount ?? 0);

  if (discountCents < 0 || surchargeCents < 0) {
    throw new MoneyError('discountAmount and surchargeAmount must be >= 0');
  }

  const amountCents = grossCents - discountCents + surchargeCents;
  if (amountCents < 0) {
    throw new MoneyError('Charged amount cannot be negative');
  }

  return {
    grossAmount: centsToMoney(grossCents),
    discountAmount: centsToMoney(discountCents),
    surchargeAmount: centsToMoney(surchargeCents),
    amount: centsToMoney(amountCents),
  };
}

export function computeGuideBilledAmountCents(
  procedures: Array<{ value: number; usedQuantity: number }>,
): number {
  return procedures.reduce(
    (sum, item) => sum + moneyToCents(item.value) * item.usedQuantity,
    0,
  );
}

export function isGuideEligibleForBilling(guide: {
  isBilled: boolean;
  inBillingBatch: boolean;
  procedures: Array<{ usedQuantity: number }>;
}): boolean {
  return (
    !guide.isBilled &&
    !guide.inBillingBatch &&
    guide.procedures.some((item) => item.usedQuantity > 0)
  );
}

export function entryStatusFromReceived(
  billedCents: number,
  receivedCents: number,
): 'paid' | 'partially_paid' {
  if (receivedCents < 0) {
    throw new MoneyError('receivedAmount must be >= 0');
  }
  return receivedCents < billedCents ? 'partially_paid' : 'paid';
}

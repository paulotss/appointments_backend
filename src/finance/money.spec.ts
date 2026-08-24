import {
  computeChargedAmount,
  computeGuideBilledAmountCents,
  entryStatusFromReceived,
  isGuideEligibleForBilling,
  MoneyError,
} from './money';

describe('computeChargedAmount', () => {
  it('returns gross as amount when there is no adjustment', () => {
    expect(computeChargedAmount({ grossAmount: 150 })).toEqual({
      grossAmount: 150,
      discountAmount: 0,
      surchargeAmount: 0,
      amount: 150,
    });
  });

  it('applies discount and surcharge', () => {
    expect(
      computeChargedAmount({
        grossAmount: 200,
        discountAmount: 30.5,
        surchargeAmount: 10.25,
      }),
    ).toEqual({
      grossAmount: 200,
      discountAmount: 30.5,
      surchargeAmount: 10.25,
      amount: 179.75,
    });
  });

  it('rejects negative net amount', () => {
    expect(() =>
      computeChargedAmount({ grossAmount: 100, discountAmount: 120 }),
    ).toThrow(MoneyError);
  });
});

describe('computeGuideBilledAmountCents', () => {
  it('multiplies value by usedQuantity', () => {
    expect(
      computeGuideBilledAmountCents([
        { value: 80.5, usedQuantity: 2 },
        { value: 10, usedQuantity: 1 },
      ]),
    ).toBe(17100);
  });
});

describe('isGuideEligibleForBilling', () => {
  it('requires unused billed flag, no batch and used quantity', () => {
    expect(
      isGuideEligibleForBilling({
        isBilled: false,
        inBillingBatch: false,
        procedures: [{ usedQuantity: 0 }, { usedQuantity: 1 }],
      }),
    ).toBe(true);

    expect(
      isGuideEligibleForBilling({
        isBilled: true,
        inBillingBatch: false,
        procedures: [{ usedQuantity: 1 }],
      }),
    ).toBe(false);

    expect(
      isGuideEligibleForBilling({
        isBilled: false,
        inBillingBatch: true,
        procedures: [{ usedQuantity: 1 }],
      }),
    ).toBe(false);

    expect(
      isGuideEligibleForBilling({
        isBilled: false,
        inBillingBatch: false,
        procedures: [{ usedQuantity: 0 }],
      }),
    ).toBe(false);
  });
});

describe('entryStatusFromReceived', () => {
  it('marks partial payment as glosa', () => {
    expect(entryStatusFromReceived(10000, 8000)).toBe('partially_paid');
    expect(entryStatusFromReceived(10000, 10000)).toBe('paid');
    expect(entryStatusFromReceived(10000, 12000)).toBe('paid');
  });
});

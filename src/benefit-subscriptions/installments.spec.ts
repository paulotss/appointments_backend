import { addYearsYmd, dueYmd, splitInstallmentCents } from './installments';

describe('benefit card installments', () => {
  it('splits the annual price in cents and adds fees only to the first parcel', () => {
    const cents = splitInstallmentCents({
      annualPrice: 300,
      installmentCount: 12,
      adhesionFee: 20,
      dependentFee: 5,
      dependentCount: 2,
    });

    expect(cents).toHaveLength(12);
    expect(cents[0]).toBe(2500 + 2000 + 1000);
    expect(cents.slice(1).every((value) => value === 2500)).toBe(true);
    expect(cents.reduce((sum, value) => sum + value, 0)).toBe(30000 + 3000);
  });

  it('puts the remainder cents on the first parcel', () => {
    const cents = splitInstallmentCents({
      annualPrice: 100,
      installmentCount: 3,
      adhesionFee: 0,
      dependentFee: 0,
      dependentCount: 0,
    });

    expect(cents).toEqual([3334, 3333, 3333]);
  });

  it('clamps the due day to the last day of the month', () => {
    expect(dueYmd('2026-01-15', 1, 31)).toBe('2026-02-28');
    expect(dueYmd('2026-01-15', 0, 10)).toBe('2026-01-10');
  });

  it('adds one year and clamps leap day', () => {
    expect(addYearsYmd('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYearsYmd('2026-03-10', 1)).toBe('2027-03-10');
  });
});

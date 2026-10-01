import { centsToMoney, moneyToCents } from '../finance/money';

export function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function formatUtcYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addYearsYmd(ymd: string, years: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const monthIndex = month - 1;
  const last = daysInUtcMonth(year + years, monthIndex);
  const clamped = Math.min(day, last);
  return formatUtcYmd(new Date(Date.UTC(year + years, monthIndex, clamped)));
}

export function dueYmd(
  startYmd: string,
  monthOffset: number,
  billingDay: number,
): string {
  const [year, month] = startYmd.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const last = daysInUtcMonth(cursor.getUTCFullYear(), cursor.getUTCMonth());
  const day = Math.min(billingDay, last);
  return formatUtcYmd(
    new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day)),
  );
}

export function splitInstallmentCents(params: {
  annualPrice: number;
  installmentCount: number;
  adhesionFee: number;
  dependentFee: number;
  dependentCount: number;
}): number[] {
  const annualCents = moneyToCents(params.annualPrice);
  const base = Math.floor(annualCents / params.installmentCount);
  const remainder = annualCents - base * params.installmentCount;
  const fees =
    moneyToCents(params.adhesionFee) +
    moneyToCents(params.dependentFee) * params.dependentCount;

  return Array.from({ length: params.installmentCount }, (_, index) =>
    index === 0 ? base + remainder + fees : base,
  );
}

export function centsListToMoney(cents: number[]): number[] {
  return cents.map((value) => centsToMoney(value));
}

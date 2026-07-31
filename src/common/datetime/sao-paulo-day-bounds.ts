const SAO_PAULO_TZ = 'America/Sao_Paulo';

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

function zonedMidnightToUtc(dateYmd: string, timeZone: string): Date {
  const [year, month, day] = dateYmd.split('-').map(Number);
  let utc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utc, timeZone);
  utc = new Date(utc.getTime() - offset);

  const refinedOffset = getTimeZoneOffsetMs(utc, timeZone);
  if (refinedOffset !== offset) {
    utc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - refinedOffset);
  }

  return utc;
}

function addCalendarDaysYmd(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Inclusive start of calendar day in America/Sao_Paulo (as UTC Date). */
export function startOfDaySaoPaulo(dateYmd: string): Date {
  return zonedMidnightToUtc(dateYmd, SAO_PAULO_TZ);
}

/** Inclusive end of calendar day in America/Sao_Paulo (as UTC Date). */
export function endOfDaySaoPaulo(dateYmd: string): Date {
  const nextDayStart = startOfDaySaoPaulo(addCalendarDaysYmd(dateYmd, 1));
  return new Date(nextDayStart.getTime() - 1);
}

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

export function addCalendarDaysYmd(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar date YYYY-MM-DD in America/Sao_Paulo. */
export function todayYmdSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
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

/** Weekday of a calendar date. 0 = Sunday ... 6 = Saturday. */
export function weekdayFromYmd(dateYmd: string): number {
  const [year, month, day] = dateYmd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function eachYmdInclusive(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addCalendarDaysYmd(cursor, 1);
    if (days.length > 366) break;
  }
  return days;
}

/** Wall-clock date and minutes from midnight in America/Sao_Paulo. */
export function saoPauloClock(date: Date): { ymd: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  let hour = Number(values.hour);
  if (hour === 24) hour = 0;

  return {
    ymd: `${values.year}-${values.month}-${values.day}`,
    minutes: hour * 60 + Number(values.minute),
  };
}

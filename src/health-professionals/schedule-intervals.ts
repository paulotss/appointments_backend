import {
  addCalendarDaysYmd,
  saoPauloClock,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';

export type MinuteInterval = {
  startMinute: number;
  endMinute: number;
};

export type ScheduleExceptionKindName = 'block' | 'release';

const START_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseStartTime(value: string): number | null {
  const match = START_TIME.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseEndTime(value: string): number | null {
  if (value === '24:00') return 1440;
  return parseStartTime(value);
}

export function formatMinute(minute: number): string {
  if (minute === 1440) return '24:00';
  const hour = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function unionIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const sorted = intervals
    .filter((item) => item.endMinute > item.startMinute)
    .sort(
      (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
    );
  const result: MinuteInterval[] = [];
  for (const item of sorted) {
    const last = result[result.length - 1];
    if (!last || item.startMinute > last.endMinute) {
      result.push({ startMinute: item.startMinute, endMinute: item.endMinute });
    } else {
      last.endMinute = Math.max(last.endMinute, item.endMinute);
    }
  }
  return result;
}

export function subtractIntervals(
  base: MinuteInterval[],
  cuts: MinuteInterval[],
): MinuteInterval[] {
  let current = unionIntervals(base);
  for (const cut of unionIntervals(cuts)) {
    const next: MinuteInterval[] = [];
    for (const item of current) {
      if (cut.endMinute <= item.startMinute || cut.startMinute >= item.endMinute) {
        next.push(item);
        continue;
      }
      if (cut.startMinute > item.startMinute) {
        next.push({ startMinute: item.startMinute, endMinute: cut.startMinute });
      }
      if (cut.endMinute < item.endMinute) {
        next.push({ startMinute: cut.endMinute, endMinute: item.endMinute });
      }
    }
    current = next;
  }
  return current;
}

export function resolveEffectiveBlocks(params: {
  weekly: MinuteInterval[];
  releases: MinuteInterval[];
  blocks: MinuteInterval[];
}): MinuteInterval[] {
  const afterRelease = subtractIntervals(params.weekly, params.releases);
  return unionIntervals([...afterRelease, ...params.blocks]);
}

export function intervalsOverlap(intervals: MinuteInterval[]): boolean {
  const sorted = [...intervals].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startMinute < sorted[index - 1].endMinute) return true;
  }
  return false;
}

export function intervalHits(
  startMinute: number,
  endMinute: number,
  blocks: MinuteInterval[],
): boolean {
  return blocks.some(
    (block) => startMinute < block.endMinute && endMinute > block.startMinute,
  );
}

export function slotCrossesBlocks(
  scheduledAt: Date,
  endsAt: Date,
  blocksForDate: (ymd: string) => MinuteInterval[],
): boolean {
  let cursor = scheduledAt;
  while (cursor.getTime() < endsAt.getTime()) {
    const clock = saoPauloClock(cursor);
    const dayEnd = startOfDaySaoPaulo(addCalendarDaysYmd(clock.ymd, 1));
    const segmentEnd = endsAt.getTime() < dayEnd.getTime() ? endsAt : dayEnd;
    const endMinute =
      segmentEnd.getTime() === dayEnd.getTime()
        ? 1440
        : saoPauloClock(segmentEnd).minutes;
    if (
      endMinute > clock.minutes &&
      intervalHits(clock.minutes, endMinute, blocksForDate(clock.ymd))
    ) {
      return true;
    }
    if (segmentEnd.getTime() <= cursor.getTime()) break;
    cursor = segmentEnd;
  }
  return false;
}

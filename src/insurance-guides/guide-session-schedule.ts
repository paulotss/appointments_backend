export const SESSION_DAY_START_MINUTE = 8 * 60;
export const SESSION_DAY_END_MINUTE = 20 * 60;
export const SESSION_SLOT_STEP_MINUTES = 15;
export const DEFAULT_SESSION_DURATION_MINUTES = 30;

export type GuideSessionSlot = {
  date: string;
  procedureIds: number[];
};

export function groupGuideSessions(
  procedures: Array<{ procedureId: number; sessionDates?: string[] }>,
): GuideSessionSlot[] {
  const byDate = new Map<string, Map<number, number>>();
  for (const item of procedures) {
    for (const date of item.sessionDates ?? []) {
      const counts = byDate.get(date) ?? new Map<number, number>();
      counts.set(item.procedureId, (counts.get(item.procedureId) ?? 0) + 1);
      byDate.set(date, counts);
    }
  }

  const slots: GuideSessionSlot[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const counts = byDate.get(date)!;
    const rounds = Math.max(...counts.values());
    for (let round = 0; round < rounds; round += 1) {
      const procedureIds = [...counts.entries()]
        .filter(([, count]) => count > round)
        .map(([procedureId]) => procedureId)
        .sort((left, right) => left - right);
      slots.push({ date, procedureIds });
    }
  }
  return slots;
}

export function nextFreeMinute(params: {
  durationMinutes: number;
  occupiedMinutes: Array<{ start: number; end: number }>;
  blockedMinutes: Array<{ startMinute: number; endMinute: number }>;
}): number | null {
  const duration = params.durationMinutes;
  for (
    let minute = SESSION_DAY_START_MINUTE;
    minute + duration <= SESSION_DAY_END_MINUTE;
    minute += SESSION_SLOT_STEP_MINUTES
  ) {
    const end = minute + duration;
    const hitsBlock = params.blockedMinutes.some(
      (block) => minute < block.endMinute && end > block.startMinute,
    );
    if (hitsBlock) continue;
    const hitsOccupied = params.occupiedMinutes.some(
      (item) => minute < item.end && end > item.start,
    );
    if (hitsOccupied) continue;
    return minute;
  }
  return null;
}

import {
  groupGuideSessions,
  nextFreeMinute,
} from './guide-session-schedule';

describe('groupGuideSessions', () => {
  it('keeps one appointment per shared date and extra rounds for repeats', () => {
    expect(
      groupGuideSessions([
        { procedureId: 2, sessionDates: ['2026-10-07', '2026-10-07', '2026-10-01'] },
        { procedureId: 1, sessionDates: ['2026-10-07', '2026-09-30'] },
      ]),
    ).toEqual([
      { date: '2026-09-30', procedureIds: [1] },
      { date: '2026-10-01', procedureIds: [2] },
      { date: '2026-10-07', procedureIds: [1, 2] },
      { date: '2026-10-07', procedureIds: [2] },
    ]);
  });
});

describe('nextFreeMinute', () => {
  it('starts at 08:00 and skips blocked or occupied intervals', () => {
    expect(
      nextFreeMinute({
        durationMinutes: 30,
        occupiedMinutes: [{ start: 8 * 60, end: 8 * 60 + 30 }],
        blockedMinutes: [],
      }),
    ).toBe(8 * 60 + 30);

    expect(
      nextFreeMinute({
        durationMinutes: 30,
        occupiedMinutes: [],
        blockedMinutes: [{ startMinute: 8 * 60, endMinute: 9 * 60 }],
      }),
    ).toBe(9 * 60);
  });

  it('returns null when the day has no gap', () => {
    expect(
      nextFreeMinute({
        durationMinutes: 30,
        occupiedMinutes: [{ start: 8 * 60, end: 20 * 60 }],
        blockedMinutes: [],
      }),
    ).toBeNull();
  });
});

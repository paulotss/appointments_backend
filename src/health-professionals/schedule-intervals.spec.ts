import {
  intervalHits,
  resolveEffectiveBlocks,
  slotCrossesBlocks,
} from './schedule-intervals';

describe('resolveEffectiveBlocks', () => {
  it('keeps the weekly block when the day has no exception', () => {
    const effective = resolveEffectiveBlocks({
      weekly: [{ startMinute: 12 * 60, endMinute: 14 * 60 }],
      releases: [],
      blocks: [],
    });

    expect(effective).toEqual([{ startMinute: 720, endMinute: 840 }]);
  });

  it('blocks the whole day when the exception covers it', () => {
    const effective = resolveEffectiveBlocks({
      weekly: [{ startMinute: 12 * 60, endMinute: 13 * 60 }],
      releases: [],
      blocks: [{ startMinute: 0, endMinute: 1440 }],
    });

    expect(effective).toEqual([{ startMinute: 0, endMinute: 1440 }]);
  });

  it('opens a weekly block for the released period', () => {
    const effective = resolveEffectiveBlocks({
      weekly: [{ startMinute: 12 * 60, endMinute: 14 * 60 }],
      releases: [{ startMinute: 12 * 60, endMinute: 13 * 60 }],
      blocks: [],
    });

    expect(effective).toEqual([{ startMinute: 780, endMinute: 840 }]);
  });

  it('lets a same-day block win over a release on the same interval', () => {
    const effective = resolveEffectiveBlocks({
      weekly: [{ startMinute: 12 * 60, endMinute: 14 * 60 }],
      releases: [{ startMinute: 12 * 60, endMinute: 14 * 60 }],
      blocks: [{ startMinute: 12 * 60, endMinute: 13 * 60 }],
    });

    expect(effective).toEqual([{ startMinute: 720, endMinute: 780 }]);
  });
});

describe('slotCrossesBlocks', () => {
  const blocksForDate = (ymd: string) =>
    ymd === '2026-10-05' ? [{ startMinute: 12 * 60, endMinute: 14 * 60 }] : [];

  it('rejects an appointment that overlaps a blocked interval', () => {
    const hits = slotCrossesBlocks(
      new Date('2026-10-05T14:00:00.000Z'),
      new Date('2026-10-05T16:00:00.000Z'),
      blocksForDate,
    );

    expect(hits).toBe(true);
  });

  it('allows an appointment that ends when the block starts', () => {
    const hits = slotCrossesBlocks(
      new Date('2026-10-05T13:00:00.000Z'),
      new Date('2026-10-05T15:00:00.000Z'),
      blocksForDate,
    );

    expect(hits).toBe(false);
    expect(intervalHits(11 * 60, 12 * 60, blocksForDate('2026-10-05'))).toBe(
      false,
    );
  });

  it('checks both calendar days when the appointment crosses midnight', () => {
    const hits = slotCrossesBlocks(
      new Date('2026-10-06T02:30:00.000Z'),
      new Date('2026-10-06T03:30:00.000Z'),
      (ymd) =>
        ymd === '2026-10-06' ? [{ startMinute: 0, endMinute: 30 }] : [],
    );

    expect(hits).toBe(true);
  });
});

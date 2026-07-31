import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from './sao-paulo-day-bounds';

describe('sao-paulo-day-bounds', () => {
  it('maps start of day to 03:00 UTC (UTC-3)', () => {
    const start = startOfDaySaoPaulo('2026-07-31');
    expect(start.toISOString()).toBe('2026-07-31T03:00:00.000Z');
  });

  it('maps end of day to 02:59:59.999 UTC next calendar day', () => {
    const end = endOfDaySaoPaulo('2026-07-31');
    expect(end.toISOString()).toBe('2026-08-01T02:59:59.999Z');
  });
});

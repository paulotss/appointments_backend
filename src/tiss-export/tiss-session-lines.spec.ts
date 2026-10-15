import { splitProcedureExecutions } from './tiss-session-lines';

describe('splitProcedureExecutions', () => {
  it('keeps a single line when there are no session dates', () => {
    expect(
      splitProcedureExecutions({
        quantity: 5,
        sessionDates: [],
        fallbackDate: '2026-08-01',
        splitBySession: true,
      }),
    ).toEqual([{ quantity: 5, executionDate: '2026-08-01' }]);
  });

  it('emits one line per session with quantity 1', () => {
    expect(
      splitProcedureExecutions({
        quantity: 5,
        sessionDates: [
          '2026-08-19',
          '2026-08-10',
          '2026-08-14',
          '2026-08-12',
          '2026-08-17',
        ],
        fallbackDate: '2026-08-19',
        splitBySession: true,
      }),
    ).toEqual([
      { quantity: 1, executionDate: '2026-08-10' },
      { quantity: 1, executionDate: '2026-08-12' },
      { quantity: 1, executionDate: '2026-08-14' },
      { quantity: 1, executionDate: '2026-08-17' },
      { quantity: 1, executionDate: '2026-08-19' },
    ]);
  });

  it('does not bill more sessions than the used quantity', () => {
    expect(
      splitProcedureExecutions({
        quantity: 2,
        sessionDates: ['2026-08-10', '2026-08-12', '2026-08-14'],
        fallbackDate: '2026-08-01',
        splitBySession: true,
      }),
    ).toEqual([
      { quantity: 1, executionDate: '2026-08-10' },
      { quantity: 1, executionDate: '2026-08-12' },
    ]);
  });

  it('keeps leftover quantity on the fallback date', () => {
    expect(
      splitProcedureExecutions({
        quantity: 5,
        sessionDates: ['2026-08-10', '2026-08-12'],
        fallbackDate: '2026-08-01',
        splitBySession: true,
      }),
    ).toEqual([
      { quantity: 1, executionDate: '2026-08-10' },
      { quantity: 1, executionDate: '2026-08-12' },
      { quantity: 3, executionDate: '2026-08-01' },
    ]);
  });

  it('does not split consulta guides', () => {
    expect(
      splitProcedureExecutions({
        quantity: 1,
        sessionDates: ['2026-08-10'],
        fallbackDate: '2026-08-10',
        splitBySession: false,
      }),
    ).toEqual([{ quantity: 1, executionDate: '2026-08-10' }]);
  });
});

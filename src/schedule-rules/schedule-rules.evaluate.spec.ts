import { ConflictException } from '@nestjs/common';
import { startOfDaySaoPaulo } from '../common/datetime/sao-paulo-day-bounds';
import {
  addMinutes,
  buildAvailableSlots,
  evaluateScheduleRules,
  inferSharedDurationMinutes,
  ScheduleRuleSnapshot,
} from './schedule-rules.evaluate';
import { assertAgentMayBook } from './assert-agent-may-book';

const TUESDAY = '2026-10-06';

function at(minutes: number): Date {
  return new Date(startOfDaySaoPaulo(TUESDAY).getTime() + minutes * 60_000);
}

function rule(
  overrides: Partial<ScheduleRuleSnapshot> = {},
): ScheduleRuleSnapshot {
  return {
    procedureId: 4,
    procedureName: 'Acupuntura',
    maxConcurrentAppointments: 3,
    durationMinutes: 60,
    slotIntervalMinutes: 60,
    allowOverbooking: false,
    windows: [{ weekday: 2, startMinute: 8 * 60, endMinute: 12 * 60 }],
    ...overrides,
  };
}

describe('evaluateScheduleRules', () => {
  const names = new Map([[4, 'Acupuntura']]);

  it('accepts a slot inside the window, on the grid and under capacity', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(8 * 60),
      endsAt: at(9 * 60),
      procedureIds: [4],
      procedureNames: names,
      rules: [rule()],
      occupiedByProcedureId: new Map([[4, 2]]),
    });
    expect(warnings).toEqual([]);
  });

  it('warns when the professional has no rule for the procedure', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(8 * 60),
      endsAt: at(9 * 60),
      procedureIds: [4],
      procedureNames: names,
      rules: [],
      occupiedByProcedureId: new Map(),
    });
    expect(warnings.map((item) => item.code)).toEqual(['missing_rule']);
  });

  it('warns when the slot is outside the attendance window', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(13 * 60),
      endsAt: at(14 * 60),
      procedureIds: [4],
      procedureNames: names,
      rules: [rule()],
      occupiedByProcedureId: new Map(),
    });
    expect(warnings.map((item) => item.code)).toEqual(['outside_window']);
  });

  it('warns when the duration does not match the rule', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(8 * 60),
      endsAt: at(8 * 60 + 30),
      procedureIds: [4],
      procedureNames: names,
      rules: [rule()],
      occupiedByProcedureId: new Map(),
    });
    expect(warnings.map((item) => item.code)).toContain('duration_mismatch');
  });

  it('warns when the start is off the slot grid', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(8 * 60 + 30),
      endsAt: at(9 * 60 + 30),
      procedureIds: [4],
      procedureNames: names,
      rules: [rule()],
      occupiedByProcedureId: new Map(),
    });
    expect(warnings.map((item) => item.code)).toEqual(['off_slot_grid']);
  });

  it('warns when concurrency is at the maximum and overbooking is off', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(8 * 60),
      endsAt: at(9 * 60),
      procedureIds: [4],
      procedureNames: names,
      rules: [rule()],
      occupiedByProcedureId: new Map([[4, 3]]),
    });
    expect(warnings.map((item) => item.code)).toEqual(['concurrency_exceeded']);
  });

  it('allows going over capacity when overbooking is on', () => {
    const warnings = evaluateScheduleRules({
      scheduledAt: at(8 * 60),
      endsAt: at(9 * 60),
      procedureIds: [4],
      procedureNames: names,
      rules: [rule({ allowOverbooking: true })],
      occupiedByProcedureId: new Map([[4, 5]]),
    });
    expect(warnings).toEqual([]);
  });
});

describe('inferSharedDurationMinutes', () => {
  it('returns the shared duration when every procedure agrees', () => {
    const result = inferSharedDurationMinutes(
      [4],
      [rule()],
      new Map([[4, 'Acupuntura']]),
    );
    expect(result).toEqual({ durationMinutes: 60 });
  });

  it('returns a duration mismatch when procedures disagree', () => {
    const result = inferSharedDurationMinutes(
      [4, 5],
      [
        rule(),
        rule({
          procedureId: 5,
          procedureName: 'Consulta',
          durationMinutes: 30,
        }),
      ],
      new Map(),
    );
    expect('warnings' in result).toBe(true);
    if ('warnings' in result) {
      expect(result.warnings.map((item) => item.code)).toEqual([
        'duration_mismatch',
        'duration_mismatch',
      ]);
    }
  });
});

describe('buildAvailableSlots', () => {
  it('hides full slots unless overbooking is allowed', () => {
    const base = rule();
    const appointments = [
      { scheduledAt: at(8 * 60), endsAt: at(9 * 60) },
      { scheduledAt: at(8 * 60), endsAt: at(9 * 60) },
      { scheduledAt: at(8 * 60), endsAt: at(9 * 60) },
    ];
    const hidden = buildAvailableSlots({
      from: TUESDAY,
      to: TUESDAY,
      rule: base,
      blocksByDate: new Map([[TUESDAY, [{ startMinute: 10 * 60, endMinute: 11 * 60 }]]]),
      appointments,
      eachDate: () => [TUESDAY],
    });
    expect(hidden.map((item) => item.scheduledAt)).toEqual([
      at(9 * 60).toISOString(),
      at(11 * 60).toISOString(),
    ]);

    const withOverbook = buildAvailableSlots({
      from: TUESDAY,
      to: TUESDAY,
      rule: rule({ allowOverbooking: true }),
      blocksByDate: new Map(),
      appointments,
      eachDate: () => [TUESDAY],
    });
    const eight = withOverbook.find(
      (item) => item.scheduledAt === at(8 * 60).toISOString(),
    );
    expect(eight).toEqual(
      expect.objectContaining({ occupied: 3, overCapacity: true }),
    );
  });
});

describe('assertAgentMayBook', () => {
  it('rejects the agent when there is any warning', () => {
    expect(() =>
      assertAgentMayBook([
        {
          code: 'missing_rule',
          procedureId: 4,
          message: 'Não há regra de atendimento para Acupuntura.',
        },
      ]),
    ).toThrow(ConflictException);
  });

  it('lets the agent continue when there are no warnings', () => {
    expect(() => assertAgentMayBook([])).not.toThrow();
  });
});

describe('addMinutes', () => {
  it('shifts the instant by the given minutes', () => {
    expect(addMinutes(at(8 * 60), 60).toISOString()).toBe(
      at(9 * 60).toISOString(),
    );
  });
});

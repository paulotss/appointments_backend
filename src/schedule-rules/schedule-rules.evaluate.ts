import {
  saoPauloClock,
  startOfDaySaoPaulo,
  weekdayFromYmd,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  intervalHits,
  MinuteInterval,
} from '../health-professionals/schedule-intervals';

export type ScheduleRuleWarningCode =
  | 'missing_rule'
  | 'outside_window'
  | 'duration_mismatch'
  | 'off_slot_grid'
  | 'concurrency_exceeded';

export type ScheduleRuleWarning = {
  code: ScheduleRuleWarningCode;
  procedureId: number;
  message: string;
};

export type ScheduleRuleWindowSnapshot = MinuteInterval & {
  weekday: number;
};

export type ScheduleRuleSnapshot = {
  procedureId: number;
  procedureName: string;
  maxConcurrentAppointments: number;
  durationMinutes: number;
  slotIntervalMinutes: number;
  allowOverbooking: boolean;
  windows: ScheduleRuleWindowSnapshot[];
};

export type AppointmentInterval = {
  scheduledAt: Date;
  endsAt: Date;
};

export type AvailableSlot = {
  scheduledAt: string;
  endsAt: string;
  occupied: number;
  overCapacity: boolean;
};

type SlotClock = {
  ymd: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
};

function slotClock(scheduledAt: Date, endsAt: Date): SlotClock | null {
  const start = saoPauloClock(scheduledAt);
  const endBoundary = saoPauloClock(new Date(endsAt.getTime() - 1));
  if (start.ymd !== endBoundary.ymd) {
    return null;
  }
  const end = saoPauloClock(endsAt);
  const endMinute = end.ymd === start.ymd ? end.minutes : 1440;
  const durationMinutes = Math.round(
    (endsAt.getTime() - scheduledAt.getTime()) / 60_000,
  );
  return {
    ymd: start.ymd,
    weekday: weekdayFromYmd(start.ymd),
    startMinute: start.minutes,
    endMinute,
    durationMinutes,
  };
}

function windowsContaining(
  rule: ScheduleRuleSnapshot,
  clock: SlotClock,
): ScheduleRuleWindowSnapshot[] {
  return rule.windows.filter(
    (window) =>
      window.weekday === clock.weekday &&
      clock.startMinute >= window.startMinute &&
      clock.endMinute <= window.endMinute,
  );
}

export function evaluateScheduleRules(params: {
  scheduledAt: Date;
  endsAt: Date;
  procedureIds: number[];
  procedureNames: Map<number, string>;
  rules: ScheduleRuleSnapshot[];
  occupiedByProcedureId: Map<number, number>;
}): ScheduleRuleWarning[] {
  const clock = slotClock(params.scheduledAt, params.endsAt);
  const warnings: ScheduleRuleWarning[] = [];
  const rulesByProcedure = new Map(
    params.rules.map((rule) => [rule.procedureId, rule]),
  );

  for (const procedureId of params.procedureIds) {
    const name =
      rulesByProcedure.get(procedureId)?.procedureName ??
      params.procedureNames.get(procedureId) ??
      `procedimento ${procedureId}`;
    const rule = rulesByProcedure.get(procedureId);
    if (!rule) {
      warnings.push({
        code: 'missing_rule',
        procedureId,
        message: `Não há regra de atendimento para ${name}.`,
      });
      continue;
    }

    if (
      clock == null ||
      clock.durationMinutes !== rule.durationMinutes ||
      clock.endMinute - clock.startMinute !== rule.durationMinutes
    ) {
      warnings.push({
        code: 'duration_mismatch',
        procedureId,
        message: `A duração de ${name} deve ser de ${rule.durationMinutes} minutos.`,
      });
    }

    if (clock == null) {
      warnings.push({
        code: 'outside_window',
        procedureId,
        message: `${name} não é atendido neste horário.`,
      });
      continue;
    }

    const containing = windowsContaining(rule, clock);
    if (containing.length === 0) {
      warnings.push({
        code: 'outside_window',
        procedureId,
        message: `${name} não é atendido neste horário.`,
      });
    } else if (
      !containing.some(
        (window) =>
          (clock.startMinute - window.startMinute) %
            rule.slotIntervalMinutes ===
          0,
      )
    ) {
      warnings.push({
        code: 'off_slot_grid',
        procedureId,
        message: `${name} só pode começar em intervalos de ${rule.slotIntervalMinutes} minutos a partir do início da janela.`,
      });
    }

    const occupied = params.occupiedByProcedureId.get(procedureId) ?? 0;
    if (!rule.allowOverbooking && occupied >= rule.maxConcurrentAppointments) {
      warnings.push({
        code: 'concurrency_exceeded',
        procedureId,
        message: `${name} já tem ${occupied} agendamento(s) neste horário (máximo ${rule.maxConcurrentAppointments}).`,
      });
    }
  }

  return warnings;
}

export function inferSharedDurationMinutes(
  procedureIds: number[],
  rules: ScheduleRuleSnapshot[],
  procedureNames: Map<number, string>,
): { durationMinutes: number } | { warnings: ScheduleRuleWarning[] } {
  const rulesByProcedure = new Map(
    rules.map((rule) => [rule.procedureId, rule]),
  );
  const warnings: ScheduleRuleWarning[] = [];
  const durations = new Set<number>();

  for (const procedureId of procedureIds) {
    const rule = rulesByProcedure.get(procedureId);
    if (!rule) {
      const name =
        procedureNames.get(procedureId) ?? `procedimento ${procedureId}`;
      warnings.push({
        code: 'missing_rule',
        procedureId,
        message: `Não há regra de atendimento para ${name}.`,
      });
      continue;
    }
    durations.add(rule.durationMinutes);
  }

  if (warnings.length > 0) {
    return { warnings };
  }
  if (durations.size !== 1) {
    return {
      warnings: procedureIds.map((procedureId) => {
        const rule = rulesByProcedure.get(procedureId);
        const name = rule?.procedureName ?? `procedimento ${procedureId}`;
        return {
          code: 'duration_mismatch' as const,
          procedureId,
          message: `A duração de ${name} deve ser de ${rule?.durationMinutes ?? 0} minutos.`,
        };
      }),
    };
  }

  return { durationMinutes: [...durations][0] };
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function buildAvailableSlots(params: {
  from: string;
  to: string;
  rule: ScheduleRuleSnapshot;
  blocksByDate: Map<string, MinuteInterval[]>;
  appointments: AppointmentInterval[];
  eachDate: (from: string, to: string) => string[];
}): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  for (const date of params.eachDate(params.from, params.to)) {
    const weekday = weekdayFromYmd(date);
    const blocks = params.blocksByDate.get(date) ?? [];
    const dayStart = startOfDaySaoPaulo(date);
    for (const window of params.rule.windows) {
      if (window.weekday !== weekday) continue;
      for (
        let start = window.startMinute;
        start + params.rule.durationMinutes <= window.endMinute;
        start += params.rule.slotIntervalMinutes
      ) {
        const end = start + params.rule.durationMinutes;
        if (intervalHits(start, end, blocks)) continue;
        const scheduledAt = new Date(dayStart.getTime() + start * 60_000);
        const endsAt = new Date(dayStart.getTime() + end * 60_000);
        const occupied = params.appointments.filter(
          (item) =>
            item.scheduledAt.getTime() < endsAt.getTime() &&
            item.endsAt.getTime() > scheduledAt.getTime(),
        ).length;
        const overCapacity = occupied >= params.rule.maxConcurrentAppointments;
        if (overCapacity && !params.rule.allowOverbooking) continue;
        slots.push({
          scheduledAt: scheduledAt.toISOString(),
          endsAt: endsAt.toISOString(),
          occupied,
          overCapacity,
        });
      }
    }
  }
  return slots;
}

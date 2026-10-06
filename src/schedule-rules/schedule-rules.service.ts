import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalAppointmentStatus,
  Prisma,
  ScheduleExceptionKind,
} from '@prisma/client';
import {
  eachYmdInclusive,
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
  weekdayFromYmd,
} from '../common/datetime/sao-paulo-day-bounds';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatMinute,
  MinuteInterval,
  resolveEffectiveBlocks,
} from '../health-professionals/schedule-intervals';
import {
  addMinutes,
  buildAvailableSlots,
  evaluateScheduleRules,
  inferSharedDurationMinutes,
  ScheduleRuleSnapshot,
  ScheduleRuleWarning,
} from './schedule-rules.evaluate';

const STATUSES_THAT_OCCUPY: ClinicalAppointmentStatus[] = [
  ClinicalAppointmentStatus.marked,
  ClinicalAppointmentStatus.confirmed,
  ClinicalAppointmentStatus.waiting,
  ClinicalAppointmentStatus.attended,
];

const MAX_SCHEDULE_DAYS = 70;

const ruleInclude = {
  procedure: { select: { id: true, name: true } },
  windows: { orderBy: [{ weekday: 'asc' as const }, { startMinute: 'asc' as const }] },
} satisfies Prisma.ProfessionalScheduleRuleInclude;

type RuleRecord = Prisma.ProfessionalScheduleRuleGetPayload<{
  include: typeof ruleInclude;
}>;

function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ScheduleRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProfessional(healthProfessionalId: number) {
    await this.ensureProfessionalExists(healthProfessionalId);
    const rules = await this.prisma.professionalScheduleRule.findMany({
      where: { healthProfessionalId },
      orderBy: { id: 'asc' },
      include: ruleInclude,
    });
    return rules.map((rule) => this.mapRule(rule));
  }

  async evaluate(params: {
    healthProfessionalId: number;
    procedureIds: number[];
    scheduledAt: Date;
    endsAt: Date;
    excludeAppointmentId?: number;
  }): Promise<ScheduleRuleWarning[]> {
    const [rules, names, occupied] = await Promise.all([
      this.loadSnapshots(params.healthProfessionalId, params.procedureIds),
      this.loadProcedureNames(params.procedureIds),
      this.occupiedCounts(params),
    ]);
    return evaluateScheduleRules({
      scheduledAt: params.scheduledAt,
      endsAt: params.endsAt,
      procedureIds: params.procedureIds,
      procedureNames: names,
      rules,
      occupiedByProcedureId: occupied,
    });
  }

  async resolveEndsAt(params: {
    healthProfessionalId: number;
    procedureIds: number[];
    scheduledAt: Date;
    endsAt?: Date | null;
    excludeAppointmentId?: number;
  }): Promise<{ endsAt: Date; warnings: ScheduleRuleWarning[] }> {
    if (params.endsAt) {
      const warnings = await this.evaluate({
        healthProfessionalId: params.healthProfessionalId,
        procedureIds: params.procedureIds,
        scheduledAt: params.scheduledAt,
        endsAt: params.endsAt,
        excludeAppointmentId: params.excludeAppointmentId,
      });
      return { endsAt: params.endsAt, warnings };
    }

    const [rules, names] = await Promise.all([
      this.loadSnapshots(params.healthProfessionalId, params.procedureIds),
      this.loadProcedureNames(params.procedureIds),
    ]);
    const inferred = inferSharedDurationMinutes(
      params.procedureIds,
      rules,
      names,
    );
    if ('warnings' in inferred) {
      return { endsAt: params.scheduledAt, warnings: inferred.warnings };
    }
    const endsAt = addMinutes(params.scheduledAt, inferred.durationMinutes);
    const warnings = evaluateScheduleRules({
      scheduledAt: params.scheduledAt,
      endsAt,
      procedureIds: params.procedureIds,
      procedureNames: names,
      rules,
      occupiedByProcedureId: await this.occupiedCounts({
        healthProfessionalId: params.healthProfessionalId,
        procedureIds: params.procedureIds,
        scheduledAt: params.scheduledAt,
        endsAt,
        excludeAppointmentId: params.excludeAppointmentId,
      }),
    });
    return { endsAt, warnings };
  }

  async availableSlots(params: {
    healthProfessionalId: number;
    procedureId: number;
    from: string;
    to: string;
  }) {
    await this.ensureProfessionalExists(params.healthProfessionalId);
    this.ensureRange(params.from, params.to);
    const [snapshot] = await this.loadSnapshots(params.healthProfessionalId, [
      params.procedureId,
    ]);
    if (!snapshot) {
      throw new NotFoundException(
        `Schedule rule for procedure ${params.procedureId} was not found`,
      );
    }

    const [weekly, exceptions, appointments] = await Promise.all([
      this.prisma.professionalWeeklyBlock.findMany({
        where: { healthProfessionalId: params.healthProfessionalId },
      }),
      this.prisma.professionalDayException.findMany({
        where: {
          healthProfessionalId: params.healthProfessionalId,
          date: {
            gte: ymdToUtcDate(params.from),
            lte: ymdToUtcDate(params.to),
          },
        },
      }),
      this.prisma.clinicalAppointment.findMany({
        where: {
          healthProfessionalId: params.healthProfessionalId,
          status: { in: STATUSES_THAT_OCCUPY },
          scheduledAt: { lt: endOfDaySaoPaulo(params.to) },
          endsAt: { gt: startOfDaySaoPaulo(params.from) },
          procedures: { some: { procedureId: params.procedureId } },
        },
        select: { scheduledAt: true, endsAt: true },
      }),
    ]);

    const blocksByDate = new Map<string, MinuteInterval[]>();
    for (const date of eachYmdInclusive(params.from, params.to)) {
      blocksByDate.set(date, this.effectiveBlocks(date, weekly, exceptions));
    }

    return {
      procedureId: snapshot.procedureId,
      procedureName: snapshot.procedureName,
      durationMinutes: snapshot.durationMinutes,
      slotIntervalMinutes: snapshot.slotIntervalMinutes,
      maxConcurrentAppointments: snapshot.maxConcurrentAppointments,
      allowOverbooking: snapshot.allowOverbooking,
      slots: buildAvailableSlots({
        from: params.from,
        to: params.to,
        rule: snapshot,
        blocksByDate,
        appointments,
        eachDate: eachYmdInclusive,
      }),
    };
  }

  private async loadSnapshots(
    healthProfessionalId: number,
    procedureIds: number[],
  ): Promise<ScheduleRuleSnapshot[]> {
    if (procedureIds.length === 0) return [];
    const rules = await this.prisma.professionalScheduleRule.findMany({
      where: {
        healthProfessionalId,
        procedureId: { in: procedureIds },
      },
      include: ruleInclude,
    });
    return rules.map((rule) => ({
      procedureId: rule.procedureId,
      procedureName: rule.procedure.name,
      maxConcurrentAppointments: rule.maxConcurrentAppointments,
      durationMinutes: rule.durationMinutes,
      slotIntervalMinutes: rule.slotIntervalMinutes,
      allowOverbooking: rule.allowOverbooking,
      windows: rule.windows.map((window) => ({
        weekday: window.weekday,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })),
    }));
  }

  private async loadProcedureNames(procedureIds: number[]) {
    const names = new Map<number, string>();
    if (procedureIds.length === 0) return names;
    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true, name: true },
    });
    for (const procedure of procedures) {
      names.set(procedure.id, procedure.name);
    }
    return names;
  }

  private async occupiedCounts(params: {
    healthProfessionalId: number;
    procedureIds: number[];
    scheduledAt: Date;
    endsAt: Date;
    excludeAppointmentId?: number;
  }) {
    const counts = new Map<number, number>();
    if (params.procedureIds.length === 0) return counts;
    const appointments = await this.prisma.clinicalAppointment.findMany({
      where: {
        healthProfessionalId: params.healthProfessionalId,
        status: { in: STATUSES_THAT_OCCUPY },
        scheduledAt: { lt: params.endsAt },
        endsAt: { gt: params.scheduledAt },
        ...(params.excludeAppointmentId !== undefined && {
          id: { not: params.excludeAppointmentId },
        }),
        procedures: { some: { procedureId: { in: params.procedureIds } } },
      },
      select: {
        procedures: { select: { procedureId: true } },
      },
    });
    const wanted = new Set(params.procedureIds);
    for (const appointment of appointments) {
      const seen = new Set<number>();
      for (const line of appointment.procedures) {
        if (!wanted.has(line.procedureId) || seen.has(line.procedureId)) {
          continue;
        }
        seen.add(line.procedureId);
        counts.set(line.procedureId, (counts.get(line.procedureId) ?? 0) + 1);
      }
    }
    return counts;
  }

  private effectiveBlocks(
    date: string,
    weekly: { weekday: number; startMinute: number; endMinute: number }[],
    exceptions: {
      date: Date;
      kind: ScheduleExceptionKind;
      startMinute: number;
      endMinute: number;
    }[],
  ): MinuteInterval[] {
    const weekday = weekdayFromYmd(date);
    const exceptionsOfDay = exceptions.filter(
      (item) => utcDateToYmd(item.date) === date,
    );
    return resolveEffectiveBlocks({
      weekly: weekly.filter((item) => item.weekday === weekday),
      releases: exceptionsOfDay
        .filter((item) => item.kind === ScheduleExceptionKind.release)
        .map((item) => ({
          startMinute: item.startMinute,
          endMinute: item.endMinute,
        })),
      blocks: exceptionsOfDay
        .filter((item) => item.kind === ScheduleExceptionKind.block)
        .map((item) => ({
          startMinute: item.startMinute,
          endMinute: item.endMinute,
        })),
    });
  }

  private mapRule(rule: RuleRecord) {
    return {
      id: rule.id,
      procedureId: rule.procedureId,
      procedure: rule.procedure,
      maxConcurrentAppointments: rule.maxConcurrentAppointments,
      durationMinutes: rule.durationMinutes,
      slotIntervalMinutes: rule.slotIntervalMinutes,
      allowOverbooking: rule.allowOverbooking,
      notes: rule.notes,
      windows: rule.windows.map((window) => ({
        weekday: window.weekday,
        startTime: formatMinute(window.startMinute),
        endTime: formatMinute(window.endMinute),
      })),
    };
  }

  private async ensureProfessionalExists(id: number) {
    const found = await this.prisma.healthProfessional.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Health professional ${id} not found`);
    }
  }

  private ensureRange(from: string, to: string) {
    if (!isValidYmd(from) || !isValidYmd(to)) {
      throw new BadRequestException('from and to must be YYYY-MM-DD');
    }
    if (to < from) {
      throw new BadRequestException('to must be on or after from');
    }
    if (eachYmdInclusive(from, to).length > MAX_SCHEDULE_DAYS) {
      throw new BadRequestException('Schedule range cannot exceed 70 days');
    }
  }
}

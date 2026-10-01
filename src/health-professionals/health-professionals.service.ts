import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ScheduleExceptionKind } from '@prisma/client';
import {
  eachYmdInclusive,
  todayYmdSaoPaulo,
  weekdayFromYmd,
} from '../common/datetime/sao-paulo-day-bounds';
import { normalizeName } from '../common/normalize-name';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthProfessionalDto } from './dto/create-health-professional.dto';
import { HealthProfessionalSpecialtyInputDto } from './dto/health-professional-specialty-input.dto';
import { ListHealthProfessionalsQueryDto } from './dto/list-health-professionals-query.dto';
import { ReplaceScheduleExceptionsDto } from './dto/replace-schedule-exceptions.dto';
import { ScheduleRangeQueryDto } from './dto/schedule-range-query.dto';
import { UpdateHealthProfessionalDto } from './dto/update-health-professional.dto';
import { WeeklyBlockInputDto } from './dto/weekly-block-input.dto';
import {
  formatMinute,
  intervalsOverlap,
  MinuteInterval,
  parseEndTime,
  parseStartTime,
  resolveEffectiveBlocks,
  slotCrossesBlocks,
} from './schedule-intervals';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

const professionalInclude = Prisma.validator<Prisma.HealthProfessionalInclude>()({
  specialties: {
    include: { specialty: true },
  },
  weeklyBlocks: {
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  },
});

type ProfessionalRecord = Prisma.HealthProfessionalGetPayload<{
  include: typeof professionalInclude;
}>;

const MAX_SCHEDULE_DAYS = 70;

@Injectable()
export class HealthProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createHealthProfessionalDto: CreateHealthProfessionalDto) {
    await this.ensureSpecialtiesValid(createHealthProfessionalDto.specialties);
    const weeklyBlocks = this.ensureWeeklyBlocksValid(
      createHealthProfessionalDto.weeklyBlocks ?? [],
    );

    try {
      const created = await this.prisma.healthProfessional.create({
        data: {
          name: normalizeName(createHealthProfessionalDto.name),
          councilType: createHealthProfessionalDto.councilType,
          councilNumber: createHealthProfessionalDto.councilNumber.trim(),
          councilUf: createHealthProfessionalDto.councilUf,
          cbosCode: createHealthProfessionalDto.cbosCode,
          cpf: digitsOnly(createHealthProfessionalDto.cpf),
          phone: createHealthProfessionalDto.phone,
          email: createHealthProfessionalDto.email,
          isActive: createHealthProfessionalDto.isActive,
          specialties: {
            create: createHealthProfessionalDto.specialties.map((item) => ({
              specialtyId: item.specialtyId,
            })),
          },
          ...(weeklyBlocks.length > 0 && {
            weeklyBlocks: {
              create: weeklyBlocks.map((item) => ({
                weekday: item.weekday,
                startMinute: item.startMinute,
                endMinute: item.endMinute,
              })),
            },
          }),
        },
        include: professionalInclude,
      });
      return this.mapProfessional(created);
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  async findAll(
    query: ListHealthProfessionalsQueryDto,
  ): Promise<ListEnvelope<ReturnType<HealthProfessionalsService['mapProfessional']>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      ...(query.name && {
        name: { contains: query.name, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.healthProfessional.findMany({
        where,
        orderBy: { id: 'asc' },
        include: professionalInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.healthProfessional.count({ where }),
    ]);

    return {
      data: data.map((item) => this.mapProfessional(item)),
      meta: buildListMeta(page, limit, total),
    };
  }

  async findOne(id: number) {
    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id },
      include: professionalInclude,
    });

    if (!professional) {
      throw new NotFoundException(`Health professional ${id} not found`);
    }

    return this.mapProfessional(professional);
  }

  async update(
    id: number,
    updateHealthProfessionalDto: UpdateHealthProfessionalDto,
  ) {
    await this.findOne(id);

    if (updateHealthProfessionalDto.specialties !== undefined) {
      await this.ensureSpecialtiesValid(
        updateHealthProfessionalDto.specialties,
      );
    }

    const weeklyBlocks =
      updateHealthProfessionalDto.weeklyBlocks !== undefined
        ? this.ensureWeeklyBlocksValid(updateHealthProfessionalDto.weeklyBlocks)
        : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (updateHealthProfessionalDto.specialties !== undefined) {
          await tx.healthProfessionalSpecialty.deleteMany({
            where: { healthProfessionalId: id },
          });
          await tx.healthProfessionalSpecialty.createMany({
            data: updateHealthProfessionalDto.specialties.map((item) => ({
              healthProfessionalId: id,
              specialtyId: item.specialtyId,
            })),
          });
        }

        if (weeklyBlocks !== undefined) {
          await tx.professionalWeeklyBlock.deleteMany({
            where: { healthProfessionalId: id },
          });
          if (weeklyBlocks.length > 0) {
            await tx.professionalWeeklyBlock.createMany({
              data: weeklyBlocks.map((item) => ({
                healthProfessionalId: id,
                weekday: item.weekday,
                startMinute: item.startMinute,
                endMinute: item.endMinute,
              })),
            });
          }
        }

        return tx.healthProfessional.update({
          where: { id },
          data: {
            ...(updateHealthProfessionalDto.name !== undefined && {
              name: normalizeName(updateHealthProfessionalDto.name),
            }),
            ...(updateHealthProfessionalDto.councilType !== undefined && {
              councilType: updateHealthProfessionalDto.councilType,
            }),
            ...(updateHealthProfessionalDto.councilNumber !== undefined && {
              councilNumber: updateHealthProfessionalDto.councilNumber.trim(),
            }),
            ...(updateHealthProfessionalDto.councilUf !== undefined && {
              councilUf:
                updateHealthProfessionalDto.councilUf == null ||
                updateHealthProfessionalDto.councilUf === ''
                  ? null
                  : updateHealthProfessionalDto.councilUf,
            }),
            ...(updateHealthProfessionalDto.cbosCode !== undefined && {
              cbosCode:
                updateHealthProfessionalDto.cbosCode == null ||
                updateHealthProfessionalDto.cbosCode === ''
                  ? null
                  : updateHealthProfessionalDto.cbosCode,
            }),
            ...(updateHealthProfessionalDto.cpf !== undefined && {
              cpf: digitsOnly(updateHealthProfessionalDto.cpf),
            }),
            ...(updateHealthProfessionalDto.phone !== undefined && {
              phone: updateHealthProfessionalDto.phone,
            }),
            ...(updateHealthProfessionalDto.email !== undefined && {
              email: updateHealthProfessionalDto.email,
            }),
            ...(updateHealthProfessionalDto.isActive !== undefined && {
              isActive: updateHealthProfessionalDto.isActive,
            }),
          },
          include: professionalInclude,
        });
      });
      return this.mapProfessional(updated);
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    const removed = await this.prisma.healthProfessional.delete({
      where: { id },
      include: professionalInclude,
    });
    return this.mapProfessional(removed);
  }

  async findSchedule(id: number, query: ScheduleRangeQueryDto) {
    await this.findOne(id);
    this.ensureScheduleRange(query.from, query.to);

    const [weekly, exceptions] = await Promise.all([
      this.prisma.professionalWeeklyBlock.findMany({
        where: { healthProfessionalId: id },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      }),
      this.prisma.professionalDayException.findMany({
        where: {
          healthProfessionalId: id,
          date: {
            gte: ymdToUtcDate(query.from),
            lte: ymdToUtcDate(query.to),
          },
        },
        orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
      }),
    ]);

    const days = eachYmdInclusive(query.from, query.to).map((date) =>
      this.composeDay(date, weekly, exceptions),
    );

    return { days };
  }

  async replaceExceptions(id: number, dto: ReplaceScheduleExceptionsDto) {
    await this.findOne(id);
    if (!isValidYmd(dto.date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }

    const exceptions = dto.exceptions.map((item) => ({
      ...this.parseInterval(item),
      kind: item.kind,
      note: item.note?.trim() ? item.note.trim() : null,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.professionalDayException.deleteMany({
        where: {
          healthProfessionalId: id,
          date: ymdToUtcDate(dto.date),
        },
      });
      if (exceptions.length > 0) {
        await tx.professionalDayException.createMany({
          data: exceptions.map((item) => ({
            healthProfessionalId: id,
            date: ymdToUtcDate(dto.date),
            kind:
              item.kind === 'release'
                ? ScheduleExceptionKind.release
                : ScheduleExceptionKind.block,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            note: item.note,
          })),
        });
      }
    });

    return this.findSchedule(id, { from: dto.date, to: dto.date });
  }

  async assertSlotAvailable(
    healthProfessionalId: number,
    scheduledAt: Date,
    endsAt: Date,
  ) {
    const startYmd = todayYmdSaoPaulo(scheduledAt);
    const endYmd = todayYmdSaoPaulo(new Date(endsAt.getTime() - 1));
    const [weekly, exceptions] = await Promise.all([
      this.prisma.professionalWeeklyBlock.findMany({
        where: { healthProfessionalId },
      }),
      this.prisma.professionalDayException.findMany({
        where: {
          healthProfessionalId,
          date: {
            gte: ymdToUtcDate(startYmd),
            lte: ymdToUtcDate(endYmd),
          },
        },
      }),
    ]);

    const byDate = new Map<string, MinuteInterval[]>();
    for (const date of eachYmdInclusive(startYmd, endYmd)) {
      byDate.set(
        date,
        this.composeDay(date, weekly, exceptions).effectiveBlocks.map(
          (item) => ({
            startMinute: parseStartTime(item.startTime) ?? 0,
            endMinute: parseEndTime(item.endTime) ?? 0,
          }),
        ),
      );
    }

    if (
      slotCrossesBlocks(
        scheduledAt,
        endsAt,
        (ymd) => byDate.get(ymd) ?? [],
      )
    ) {
      throw new ConflictException('Schedule slot is blocked');
    }
  }

  private composeDay(
    date: string,
    weekly: { weekday: number; startMinute: number; endMinute: number }[],
    exceptions: {
      date: Date;
      kind: ScheduleExceptionKind;
      startMinute: number;
      endMinute: number;
      note: string | null;
    }[],
  ) {
    const weekday = weekdayFromYmd(date);
    const weeklyOfDay = weekly.filter((item) => item.weekday === weekday);
    const exceptionsOfDay = exceptions.filter(
      (item) => utcDateToYmd(item.date) === date,
    );
    const effective = resolveEffectiveBlocks({
      weekly: weeklyOfDay,
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

    return {
      date,
      weekday,
      weeklyBlocks: weeklyOfDay.map((item) => this.toTimeRange(item)),
      exceptions: exceptionsOfDay.map((item) => ({
        kind:
          item.kind === ScheduleExceptionKind.release
            ? ('release' as const)
            : ('block' as const),
        ...this.toTimeRange(item),
        note: item.note,
      })),
      effectiveBlocks: effective.map((item) => this.toTimeRange(item)),
    };
  }

  private ensureScheduleRange(from: string, to: string) {
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

  private ensureWeeklyBlocksValid(blocks: WeeklyBlockInputDto[]) {
    const parsed = blocks.map((item) => ({
      weekday: item.weekday,
      ...this.parseInterval(item),
    }));

    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const sameDay = parsed.filter((item) => item.weekday === weekday);
      if (intervalsOverlap(sameDay)) {
        throw new BadRequestException(
          'Weekly blocks on the same weekday cannot overlap',
        );
      }
    }

    return parsed;
  }

  private parseInterval(item: {
    startTime: string;
    endTime: string;
  }): MinuteInterval {
    const startMinute = parseStartTime(item.startTime);
    const endMinute = parseEndTime(item.endTime);
    if (startMinute == null || endMinute == null || endMinute <= startMinute) {
      throw new BadRequestException('endTime must be after startTime');
    }
    return { startMinute, endMinute };
  }

  private toTimeRange(item: MinuteInterval) {
    return {
      startTime: formatMinute(item.startMinute),
      endTime: formatMinute(item.endMinute),
    };
  }

  private mapProfessional(professional: ProfessionalRecord) {
    return {
      ...professional,
      weeklyBlocks: professional.weeklyBlocks.map((block) => ({
        weekday: block.weekday,
        startTime: formatMinute(block.startMinute),
        endTime: formatMinute(block.endMinute),
      })),
    };
  }

  private async ensureSpecialtiesValid(
    specialties: HealthProfessionalSpecialtyInputDto[],
  ) {
    if (!specialties.length) {
      throw new BadRequestException(
        'At least one specialty is required for a health professional',
      );
    }

    const specialtyIds = specialties.map((item) => item.specialtyId);
    const uniqueIds = new Set(specialtyIds);

    if (uniqueIds.size !== specialtyIds.length) {
      throw new BadRequestException(
        'Duplicate specialties are not allowed for a health professional',
      );
    }

    const found = await this.prisma.specialty.findMany({
      where: { id: { in: specialtyIds } },
      select: { id: true },
    });

    if (found.length !== specialtyIds.length) {
      const foundIds = new Set(found.map((item) => item.id));
      const missing = specialtyIds.find((id) => !foundIds.has(id));
      throw new NotFoundException(`Specialty ${missing} not found`);
    }
  }

  private rethrowKnownPrismaError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Já existe um profissional com este CPF.');
    }
  }
}

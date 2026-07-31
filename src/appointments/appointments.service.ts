import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import { normalizeName } from '../common/normalize-name';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const EXPORT_MAX_ROWS = 10_000;

const attendantOmit = {
  omit: { passwordHash: true } as const,
};

const appointmentCallInclude = {
  include: {
    user: {
      omit: { passwordHash: true } as const,
    },
  },
} as const;

const appointmentMessageInclude = {
  include: {
    user: {
      omit: { passwordHash: true } as const,
    },
  },
} as const;

const appointmentInclude = {
  specialty: true,
  attendant: attendantOmit,
  call: appointmentCallInclude,
  message: appointmentMessageInclude,
} as const;

export type AppointmentListCounts = {
  scheduledYes: number;
  scheduledNo: number;
  firstTimeYes: number;
  firstTimeNo: number;
  total: number;
};

type AppointmentListItem = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAppointmentDto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: this.mapCreateDtoToData(createAppointmentDto),
      include: appointmentInclude,
    });
  }

  async findAll(
    query: ListAppointmentsQueryDto,
    currentUser: JwtPayload,
  ): Promise<ListEnvelope<AppointmentListItem, AppointmentListCounts>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { where, whereWithoutChipFilters } = this.buildListWhere(
      query,
      currentUser,
    );

    const [data, total, scheduledGroups, firstTimeGroups] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.groupBy({
        by: ['scheduled'],
        where: whereWithoutChipFilters,
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['firstTime'],
        where: whereWithoutChipFilters,
        _count: { _all: true },
      }),
    ]);

    return {
      data,
      meta: buildListMeta(page, limit, total),
      counts: this.mapListCounts(scheduledGroups, firstTimeGroups),
    };
  }

  async exportAll(
    query: ListAppointmentsQueryDto,
    currentUser: JwtPayload,
  ): Promise<AppointmentListItem[]> {
    const { where } = this.buildListWhere(query, currentUser);
    const total = await this.prisma.appointment.count({ where });

    if (total > EXPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Export exceeds safety limit of ${EXPORT_MAX_ROWS} rows (found ${total}). Narrow the date range or filters.`,
      );
    }

    return this.prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: EXPORT_MAX_ROWS,
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    return appointment;
  }

  async update(id: number, updateAppointmentDto: UpdateAppointmentDto) {
    await this.findOne(id);

    return this.prisma.appointment.update({
      where: { id },
      data: this.mapUpdateDtoToData(updateAppointmentDto),
      include: appointmentInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.appointment.delete({ where: { id } });
  }

  private buildListWhere(
    query: ListAppointmentsQueryDto,
    currentUser: JwtPayload,
  ) {
    const date: Prisma.DateTimeFilter = {
      gte: startOfDaySaoPaulo(query.from),
      lte: endOfDaySaoPaulo(query.to),
    };

    const base: Prisma.AppointmentWhereInput = {
      date,
      ...this.resolveAttendantFilter(currentUser, query.attendantId),
    };

    if (query.contactMethod !== undefined) {
      base.contactMethod = query.contactMethod;
    }
    if (query.specialtyId !== undefined) {
      base.specialtyId = query.specialtyId;
    }

    const whereWithoutChipFilters: Prisma.AppointmentWhereInput = { ...base };
    const where: Prisma.AppointmentWhereInput = { ...base };

    if (query.firstTime !== undefined) {
      where.firstTime = query.firstTime;
    }
    if (query.scheduled !== undefined) {
      where.scheduled = query.scheduled;
    }

    return { where, whereWithoutChipFilters };
  }

  private resolveAttendantFilter(
    currentUser: JwtPayload,
    requestedAttendantId?: number,
  ): Prisma.AppointmentWhereInput {
    if (currentUser.isAdmin) {
      if (requestedAttendantId !== undefined) {
        return { attendantId: requestedAttendantId };
      }
      return {};
    }

    if (
      requestedAttendantId !== undefined &&
      requestedAttendantId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'Non-admin users cannot filter appointments by another attendantId',
      );
    }

    return { attendantId: currentUser.sub };
  }

  private mapListCounts(
    scheduledGroups: Array<{
      scheduled: boolean;
      _count: { _all: number };
    }>,
    firstTimeGroups: Array<{
      firstTime: boolean;
      _count: { _all: number };
    }>,
  ): AppointmentListCounts {
    let scheduledYes = 0;
    let scheduledNo = 0;
    for (const group of scheduledGroups) {
      if (group.scheduled) {
        scheduledYes = group._count._all;
      } else {
        scheduledNo = group._count._all;
      }
    }

    let firstTimeYes = 0;
    let firstTimeNo = 0;
    for (const group of firstTimeGroups) {
      if (group.firstTime) {
        firstTimeYes = group._count._all;
      } else {
        firstTimeNo = group._count._all;
      }
    }

    return {
      scheduledYes,
      scheduledNo,
      firstTimeYes,
      firstTimeNo,
      total: scheduledYes + scheduledNo,
    };
  }

  private mapCreateDtoToData(
    dto: CreateAppointmentDto,
  ): Prisma.AppointmentUncheckedCreateInput {
    return {
      date: new Date(dto.date),
      clientName: normalizeName(dto.clientName),
      phone: dto.phone,
      contactMethod: dto.contactMethod,
      firstTime: dto.firstTime,
      scheduled: dto.scheduled,
      reason: dto.reason,
      specialtyId: dto.specialtyId,
      notes: dto.notes,
      attendantId: dto.attendantId,
      callId: dto.callId ?? undefined,
      messageId: dto.messageId ?? undefined,
    };
  }

  private mapUpdateDtoToData(
    dto: UpdateAppointmentDto,
  ): Prisma.AppointmentUncheckedUpdateInput {
    return {
      date: dto.date ? new Date(dto.date) : undefined,
      clientName:
        dto.clientName !== undefined
          ? normalizeName(dto.clientName)
          : undefined,
      phone: dto.phone,
      contactMethod: dto.contactMethod,
      firstTime: dto.firstTime,
      scheduled: dto.scheduled,
      reason: dto.reason,
      specialtyId: dto.specialtyId,
      notes: dto.notes,
      attendantId: dto.attendantId,
      callId: dto.callId,
      messageId: dto.messageId,
    };
  }
}

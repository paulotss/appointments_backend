import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallRecordStatus, CallStatus, Prisma } from '@prisma/client';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
  mapRecordStatusCounts,
} from '../common/pagination/list-envelope';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCallDto } from './dto/create-call.dto';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';
import { UpdateCallDto } from './dto/update-call.dto';

const userInclude = {
  omit: { passwordHash: true } as const,
};

const callAppointmentInclude = {
  include: {
    specialty: true,
    attendant: {
      omit: { passwordHash: true } as const,
    },
  },
} as const;

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCallDto: CreateCallDto) {
    const user = await this.prisma.user.findUnique({
      where: { extension: createCallDto.extension },
      select: { id: true },
    });

    const recordStatus = createCallDto.recordStatus ?? CallRecordStatus.pending;

    return this.prisma.call.create({
      data: {
        receivedAt: createCallDto.receivedAt
          ? new Date(createCallDto.receivedAt)
          : undefined,
        origin: createCallDto.origin,
        destination: createCallDto.destination,
        extension: createCallDto.extension,
        status: createCallDto.status,
        recordStatus,
        note: createCallDto.note ?? undefined,
        userId: user?.id,
      },
      include: { user: userInclude, appointment: callAppointmentInclude },
    });
  }

  async findAll(
    query: ListCallsQueryDto,
    currentUser: JwtPayload,
  ): Promise<ListEnvelope<Prisma.CallGetPayload<{
    include: {
      user: typeof userInclude;
      appointment: typeof callAppointmentInclude;
    };
  }>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { where, whereWithoutRecordStatus } = this.buildListWhere(
      query,
      currentUser,
    );

    const [data, total, groups] = await Promise.all([
      this.prisma.call.findMany({
        where,
        include: { user: userInclude, appointment: callAppointmentInclude },
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.call.count({ where }),
      this.prisma.call.groupBy({
        by: ['recordStatus'],
        where: whereWithoutRecordStatus,
        _count: { _all: true },
      }),
    ]);

    return {
      data,
      meta: buildListMeta(page, limit, total),
      counts: mapRecordStatusCounts(groups),
    };
  }

  async findOne(id: number) {
    const call = await this.prisma.call.findUnique({
      where: { id },
      include: { user: userInclude, appointment: callAppointmentInclude },
    });

    if (!call) {
      throw new NotFoundException(`Call ${id} not found`);
    }

    return call;
  }

  async update(id: number, updateCallDto: UpdateCallDto) {
    const existing = await this.findOne(id);

    const nextRecordStatus =
      updateCallDto.recordStatus ?? existing.recordStatus;
    const nextNote =
      updateCallDto.note !== undefined ? updateCallDto.note : existing.note;

    if (nextRecordStatus === CallRecordStatus.cancelled) {
      const trimmed = (nextNote ?? '').trim();
      if (!trimmed) {
        throw new BadRequestException(
          'note is required when recordStatus is cancelled',
        );
      }
    }

    const data: Prisma.CallUncheckedUpdateInput = {};
    if (updateCallDto.status !== undefined) {
      data.status = updateCallDto.status;
    }
    if (updateCallDto.destination !== undefined) {
      data.destination = updateCallDto.destination;
    }
    if (updateCallDto.recordStatus !== undefined) {
      data.recordStatus = updateCallDto.recordStatus;
    }
    if (updateCallDto.note !== undefined) {
      data.note = updateCallDto.note;
    }

    return this.prisma.call.update({
      where: { id },
      data,
      include: { user: userInclude, appointment: callAppointmentInclude },
    });
  }

  private buildListWhere(query: ListCallsQueryDto, currentUser: JwtPayload) {
    const receivedAt: Prisma.DateTimeFilter = {
      gte: startOfDaySaoPaulo(query.from),
      lte: endOfDaySaoPaulo(query.to),
    };

    const base: Prisma.CallWhereInput = { receivedAt };

    if (query.statuses?.length) {
      base.status = { in: query.statuses };
    }

    const visibilityAndUser = this.resolveVisibilityAndUserFilter(
      currentUser,
      query.userId,
    );
    Object.assign(base, visibilityAndUser);

    const whereWithoutRecordStatus: Prisma.CallWhereInput = { ...base };
    const where: Prisma.CallWhereInput = { ...base };
    if (query.recordStatus !== undefined) {
      where.recordStatus = query.recordStatus;
    }

    return { where, whereWithoutRecordStatus };
  }

  private resolveVisibilityAndUserFilter(
    currentUser: JwtPayload,
    requestedUserId?: number,
  ): Prisma.CallWhereInput {
    if (currentUser.isAdmin) {
      if (requestedUserId !== undefined) {
        return { userId: requestedUserId };
      }
      return {};
    }

    if (
      requestedUserId !== undefined &&
      requestedUserId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'Non-admin users cannot filter calls by another userId',
      );
    }

    const visibility: Prisma.CallWhereInput = {
      OR: [
        { userId: currentUser.sub },
        { status: CallStatus.NAO_ATENDIDO },
      ],
    };

    if (requestedUserId !== undefined) {
      return {
        AND: [visibility, { userId: requestedUserId }],
      };
    }

    return visibility;
  }
}

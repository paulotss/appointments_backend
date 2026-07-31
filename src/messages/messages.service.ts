import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CallRecordStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
  mapRecordStatusCounts,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

const userInclude = {
  omit: { passwordHash: true } as const,
};

const messageAppointmentInclude = {
  include: {
    specialty: true,
    attendant: {
      omit: { passwordHash: true } as const,
    },
  },
} as const;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto) {
    const user = createMessageDto.humanEmail
      ? await this.prisma.user.findUnique({
          where: { email: createMessageDto.humanEmail },
          select: { id: true },
        })
      : null;

    const content = await this.fetchInteractionMessages(
      createMessageDto.interactionId,
    );

    const recordStatus =
      createMessageDto.recordStatus ?? CallRecordStatus.pending;

    return this.prisma.message.create({
      data: {
        finishAt: new Date(createMessageDto.finishAt),
        recipient: createMessageDto.recipient,
        name: createMessageDto.name,
        interactionId: createMessageDto.interactionId,
        content: content ?? Prisma.JsonNull,
        recordStatus,
        note: createMessageDto.note ?? undefined,
        userId: user?.id,
      },
      include: { user: userInclude, appointment: messageAppointmentInclude },
    });
  }

  async findAll(
    query: ListMessagesQueryDto,
    currentUser: JwtPayload,
  ): Promise<
    ListEnvelope<
      Prisma.MessageGetPayload<{
        omit: { content: true };
        include: {
          user: typeof userInclude;
          appointment: typeof messageAppointmentInclude;
        };
      }>
    >
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { where, whereWithoutRecordStatus } = this.buildListWhere(
      query,
      currentUser,
    );

    const [data, total, groups] = await Promise.all([
      this.prisma.message.findMany({
        where,
        omit: { content: true },
        include: { user: userInclude, appointment: messageAppointmentInclude },
        orderBy: { finishAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({ where }),
      this.prisma.message.groupBy({
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
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: { user: userInclude, appointment: messageAppointmentInclude },
    });

    if (!message) {
      throw new NotFoundException(`Message ${id} not found`);
    }

    return message;
  }

  async update(id: number, updateMessageDto: UpdateMessageDto) {
    const existing = await this.findOne(id);

    const nextRecordStatus =
      updateMessageDto.recordStatus ?? existing.recordStatus;
    const nextNote =
      updateMessageDto.note !== undefined
        ? updateMessageDto.note
        : existing.note;

    if (nextRecordStatus === CallRecordStatus.cancelled) {
      const trimmed = (nextNote ?? '').trim();
      if (!trimmed) {
        throw new BadRequestException(
          'note is required when recordStatus is cancelled',
        );
      }
    }

    const data: Prisma.MessageUncheckedUpdateInput = {};
    if (updateMessageDto.recordStatus !== undefined) {
      data.recordStatus = updateMessageDto.recordStatus;
    }
    if (updateMessageDto.note !== undefined) {
      data.note = updateMessageDto.note;
    }

    return this.prisma.message.update({
      where: { id },
      data,
      include: { user: userInclude, appointment: messageAppointmentInclude },
    });
  }

  private buildListWhere(
    query: ListMessagesQueryDto,
    currentUser: JwtPayload,
  ) {
    const finishAt: Prisma.DateTimeFilter = {
      gte: startOfDaySaoPaulo(query.from),
      lte: endOfDaySaoPaulo(query.to),
    };

    const base: Prisma.MessageWhereInput = {
      finishAt,
      ...this.resolveUserFilter(currentUser, query.userId),
    };

    const whereWithoutRecordStatus: Prisma.MessageWhereInput = { ...base };
    const where: Prisma.MessageWhereInput = { ...base };
    if (query.recordStatus !== undefined) {
      where.recordStatus = query.recordStatus;
    }

    return { where, whereWithoutRecordStatus };
  }

  private resolveUserFilter(
    currentUser: JwtPayload,
    requestedUserId?: number,
  ): Prisma.MessageWhereInput {
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
        'Non-admin users cannot filter messages by another userId',
      );
    }

    return { userId: currentUser.sub };
  }

  private async fetchInteractionMessages(
    interactionId: string,
  ): Promise<Prisma.InputJsonValue | null> {
    const token = process.env.GPT_MAKER_TOKEN;
    if (!token) {
      this.logger.warn(
        'GPT_MAKER_TOKEN is not set; saving message without content',
      );
      return null;
    }

    const url = `https://api.gptmaker.ai/v2/interaction/${encodeURIComponent(interactionId)}/messages`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `GPT Maker messages fetch failed (${response.status}) for interaction ${interactionId}`,
        );
        return null;
      }

      return (await response.json()) as Prisma.InputJsonValue;
    } catch (error) {
      this.logger.warn(
        `GPT Maker messages fetch error for interaction ${interactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CallRecordStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
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

  findAll() {
    return this.prisma.message.findMany({
      include: { user: userInclude, appointment: messageAppointmentInclude },
      orderBy: { finishAt: 'desc' },
    });
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

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallRecordStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';

const userInclude = {
  omit: { passwordHash: true } as const,
};

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
        extension: createCallDto.extension,
        status: createCallDto.status,
        recordStatus,
        note: createCallDto.note ?? undefined,
        userId: user?.id,
      },
      include: { user: userInclude },
    });
  }

  findAll() {
    return this.prisma.call.findMany({
      include: { user: userInclude },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const call = await this.prisma.call.findUnique({
      where: { id },
      include: { user: userInclude },
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
    if (updateCallDto.recordStatus !== undefined) {
      data.recordStatus = updateCallDto.recordStatus;
    }
    if (updateCallDto.note !== undefined) {
      data.note = updateCallDto.note;
    }

    return this.prisma.call.update({
      where: { id },
      data,
      include: { user: userInclude },
    });
  }
}

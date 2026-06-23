import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const appointmentCallInclude = {
  include: {
    user: {
      omit: { passwordHash: true } as const,
    },
  },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAppointmentDto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: this.mapCreateDtoToData(createAppointmentDto),
      include: {
        specialty: true,
        attendant: true,
        call: appointmentCallInclude,
      },
    });
  }

  findAll() {
    return this.prisma.appointment.findMany({
      include: {
        specialty: true,
        attendant: true,
        call: appointmentCallInclude,
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        specialty: true,
        attendant: true,
        call: appointmentCallInclude,
      },
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
      include: {
        specialty: true,
        attendant: true,
        call: appointmentCallInclude,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.appointment.delete({ where: { id } });
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
    };
  }
}

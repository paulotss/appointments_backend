import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

const patientDetailInclude = {
  insuranceCards: {
    include: { healthPlan: true },
    orderBy: { id: 'asc' as const },
  },
} as const;

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPatientDto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        name: normalizeName(createPatientDto.name),
        phone: createPatientDto.phone,
        email: createPatientDto.email,
        birthDate: createPatientDto.birthDate
          ? new Date(createPatientDto.birthDate)
          : null,
        cpf: createPatientDto.cpf ? digitsOnly(createPatientDto.cpf) : null,
      },
      include: patientDetailInclude,
    });
  }

  async findAll(query: ListPatientsQueryDto): Promise<ListEnvelope<Patient>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      ...(query.name && {
        name: { contains: query.name, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data,
      meta: buildListMeta(page, limit, total),
    };
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: patientDetailInclude,
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${id} not found`);
    }

    return patient;
  }

  async update(id: number, updatePatientDto: UpdatePatientDto) {
    await this.findOne(id);

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...(updatePatientDto.name !== undefined && {
          name: normalizeName(updatePatientDto.name),
        }),
        ...(updatePatientDto.phone !== undefined && {
          phone: updatePatientDto.phone,
        }),
        ...(updatePatientDto.email !== undefined && {
          email: updatePatientDto.email,
        }),
        ...(updatePatientDto.birthDate !== undefined && {
          birthDate: updatePatientDto.birthDate
            ? new Date(updatePatientDto.birthDate)
            : null,
        }),
        ...(updatePatientDto.cpf !== undefined && {
          cpf: updatePatientDto.cpf ? digitsOnly(updatePatientDto.cpf) : null,
        }),
      },
      include: patientDetailInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.patient.delete({ where: { id } });
  }
}

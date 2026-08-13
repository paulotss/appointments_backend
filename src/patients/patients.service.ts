import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPatientDto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        name: normalizeName(createPatientDto.name),
        phone: createPatientDto.phone,
        email: createPatientDto.email,
        birthDate: new Date(createPatientDto.birthDate),
        cpf: digitsOnly(createPatientDto.cpf),
      },
    });
  }

  findAll() {
    return this.prisma.patient.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });

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
          birthDate: new Date(updatePatientDto.birthDate),
        }),
        ...(updatePatientDto.cpf !== undefined && {
          cpf: digitsOnly(updatePatientDto.cpf),
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.patient.delete({ where: { id } });
  }
}

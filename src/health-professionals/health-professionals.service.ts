import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthProfessionalDto } from './dto/create-health-professional.dto';
import { UpdateHealthProfessionalDto } from './dto/update-health-professional.dto';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

@Injectable()
export class HealthProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createHealthProfessionalDto: CreateHealthProfessionalDto) {
    await this.ensureSpecialtyExists(createHealthProfessionalDto.specialtyId);

    return this.prisma.healthProfessional.create({
      data: {
        name: normalizeName(createHealthProfessionalDto.name),
        specialtyId: createHealthProfessionalDto.specialtyId,
        councilType: createHealthProfessionalDto.councilType,
        councilNumber: createHealthProfessionalDto.councilNumber.trim(),
        cpf: digitsOnly(createHealthProfessionalDto.cpf),
        phone: createHealthProfessionalDto.phone,
        email: createHealthProfessionalDto.email,
        isActive: createHealthProfessionalDto.isActive,
      },
      include: { specialty: true },
    });
  }

  findAll() {
    return this.prisma.healthProfessional.findMany({
      orderBy: { id: 'asc' },
      include: { specialty: true },
    });
  }

  async findOne(id: number) {
    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id },
      include: { specialty: true },
    });

    if (!professional) {
      throw new NotFoundException(`Health professional ${id} not found`);
    }

    return professional;
  }

  async update(
    id: number,
    updateHealthProfessionalDto: UpdateHealthProfessionalDto,
  ) {
    await this.findOne(id);

    if (updateHealthProfessionalDto.specialtyId !== undefined) {
      await this.ensureSpecialtyExists(updateHealthProfessionalDto.specialtyId);
    }

    return this.prisma.healthProfessional.update({
      where: { id },
      data: {
        ...(updateHealthProfessionalDto.name !== undefined && {
          name: normalizeName(updateHealthProfessionalDto.name),
        }),
        ...(updateHealthProfessionalDto.specialtyId !== undefined && {
          specialtyId: updateHealthProfessionalDto.specialtyId,
        }),
        ...(updateHealthProfessionalDto.councilType !== undefined && {
          councilType: updateHealthProfessionalDto.councilType,
        }),
        ...(updateHealthProfessionalDto.councilNumber !== undefined && {
          councilNumber: updateHealthProfessionalDto.councilNumber.trim(),
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
      include: { specialty: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.healthProfessional.delete({
      where: { id },
      include: { specialty: true },
    });
  }

  private async ensureSpecialtyExists(specialtyId: number) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: specialtyId },
    });

    if (!specialty) {
      throw new NotFoundException(`Specialty ${specialtyId} not found`);
    }
  }
}

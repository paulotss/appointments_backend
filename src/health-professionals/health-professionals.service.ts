import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthProfessionalDto } from './dto/create-health-professional.dto';
import { HealthProfessionalSpecialtyInputDto } from './dto/health-professional-specialty-input.dto';
import { UpdateHealthProfessionalDto } from './dto/update-health-professional.dto';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

const professionalInclude = {
  specialties: {
    include: { specialty: true },
  },
} as const;

@Injectable()
export class HealthProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createHealthProfessionalDto: CreateHealthProfessionalDto) {
    await this.ensureSpecialtiesValid(createHealthProfessionalDto.specialties);

    return this.prisma.healthProfessional.create({
      data: {
        name: normalizeName(createHealthProfessionalDto.name),
        councilType: createHealthProfessionalDto.councilType,
        councilNumber: createHealthProfessionalDto.councilNumber.trim(),
        cpf: digitsOnly(createHealthProfessionalDto.cpf),
        phone: createHealthProfessionalDto.phone,
        email: createHealthProfessionalDto.email,
        isActive: createHealthProfessionalDto.isActive,
        specialties: {
          create: createHealthProfessionalDto.specialties.map((item) => ({
            specialtyId: item.specialtyId,
            privatePrice: item.privatePrice,
          })),
        },
      },
      include: professionalInclude,
    });
  }

  findAll() {
    return this.prisma.healthProfessional.findMany({
      orderBy: { id: 'asc' },
      include: professionalInclude,
    });
  }

  async findOne(id: number) {
    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id },
      include: professionalInclude,
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

    if (updateHealthProfessionalDto.specialties !== undefined) {
      await this.ensureSpecialtiesValid(
        updateHealthProfessionalDto.specialties,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateHealthProfessionalDto.specialties !== undefined) {
        await tx.healthProfessionalSpecialty.deleteMany({
          where: { healthProfessionalId: id },
        });
        await tx.healthProfessionalSpecialty.createMany({
          data: updateHealthProfessionalDto.specialties.map((item) => ({
            healthProfessionalId: id,
            specialtyId: item.specialtyId,
            privatePrice: item.privatePrice,
          })),
        });
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
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.healthProfessional.delete({
      where: { id },
      include: professionalInclude,
    });
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
}

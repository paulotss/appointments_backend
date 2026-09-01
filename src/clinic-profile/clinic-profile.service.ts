import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertClinicProfileDto } from './dto/upsert-clinic-profile.dto';

const CLINIC_PROFILE_ID = 1;

function digitsOnly(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = value.replace(/\D/g, '');
  return digits === '' ? null : digits;
}

@Injectable()
export class ClinicProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async find() {
    const existing = await this.prisma.clinicProfile.findUnique({
      where: { id: CLINIC_PROFILE_ID },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.clinicProfile.create({
      data: { id: CLINIC_PROFILE_ID },
    });
  }

  async upsert(dto: UpsertClinicProfileDto) {
    await this.find();

    return this.prisma.clinicProfile.update({
      where: { id: CLINIC_PROFILE_ID },
      data: {
        ...(dto.legalName !== undefined && {
          legalName:
            dto.legalName == null || dto.legalName.trim() === ''
              ? null
              : dto.legalName.trim(),
        }),
        ...(dto.cnpj !== undefined && { cnpj: digitsOnly(dto.cnpj) }),
        ...(dto.cnes !== undefined && { cnes: digitsOnly(dto.cnes) }),
      },
    });
  }
}

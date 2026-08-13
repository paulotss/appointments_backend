import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInsuranceGuideDto } from './dto/create-insurance-guide.dto';
import { UpdateInsuranceGuideDto } from './dto/update-insurance-guide.dto';

const guideInclude = {
  healthPlan: true,
  patient: true,
  specialty: true,
  healthProfessional: true,
} as const;

@Injectable()
export class InsuranceGuidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInsuranceGuideDto: CreateInsuranceGuideDto) {
    const healthPlan = await this.ensureHealthPlanExists(
      createInsuranceGuideDto.healthPlanId,
    );
    await this.ensurePatientExists(createInsuranceGuideDto.patientId);
    await this.ensureSpecialtyExists(createInsuranceGuideDto.specialtyId);
    await this.ensureHealthProfessionalExists(
      createInsuranceGuideDto.healthProfessionalId,
    );
    await this.ensureProfessionalHasSpecialty(
      createInsuranceGuideDto.healthProfessionalId,
      createInsuranceGuideDto.specialtyId,
    );

    const expirationDate =
      createInsuranceGuideDto.expirationDate !== undefined
        ? new Date(createInsuranceGuideDto.expirationDate)
        : this.defaultExpirationDate(healthPlan.submissionDeadlineDays);

    return this.prisma.insuranceGuide.create({
      data: {
        healthPlanId: createInsuranceGuideDto.healthPlanId,
        patientId: createInsuranceGuideDto.patientId,
        specialtyId: createInsuranceGuideDto.specialtyId,
        healthProfessionalId: createInsuranceGuideDto.healthProfessionalId,
        quantity: createInsuranceGuideDto.quantity,
        expirationDate,
      },
      include: guideInclude,
    });
  }

  findAll() {
    return this.prisma.insuranceGuide.findMany({
      orderBy: { id: 'asc' },
      include: guideInclude,
    });
  }

  async findOne(id: number) {
    const guide = await this.prisma.insuranceGuide.findUnique({
      where: { id },
      include: guideInclude,
    });

    if (!guide) {
      throw new NotFoundException(`Insurance guide ${id} not found`);
    }

    return guide;
  }

  async update(id: number, updateInsuranceGuideDto: UpdateInsuranceGuideDto) {
    const existing = await this.findOne(id);

    if (updateInsuranceGuideDto.healthPlanId !== undefined) {
      await this.ensureHealthPlanExists(updateInsuranceGuideDto.healthPlanId);
    }

    if (updateInsuranceGuideDto.patientId !== undefined) {
      await this.ensurePatientExists(updateInsuranceGuideDto.patientId);
    }

    if (updateInsuranceGuideDto.specialtyId !== undefined) {
      await this.ensureSpecialtyExists(updateInsuranceGuideDto.specialtyId);
    }

    if (updateInsuranceGuideDto.healthProfessionalId !== undefined) {
      await this.ensureHealthProfessionalExists(
        updateInsuranceGuideDto.healthProfessionalId,
      );
    }

    const healthProfessionalId =
      updateInsuranceGuideDto.healthProfessionalId ??
      existing.healthProfessionalId;
    const specialtyId =
      updateInsuranceGuideDto.specialtyId ?? existing.specialtyId;

    if (
      updateInsuranceGuideDto.healthProfessionalId !== undefined ||
      updateInsuranceGuideDto.specialtyId !== undefined
    ) {
      await this.ensureProfessionalHasSpecialty(
        healthProfessionalId,
        specialtyId,
      );
    }

    return this.prisma.insuranceGuide.update({
      where: { id },
      data: {
        ...(updateInsuranceGuideDto.healthPlanId !== undefined && {
          healthPlanId: updateInsuranceGuideDto.healthPlanId,
        }),
        ...(updateInsuranceGuideDto.patientId !== undefined && {
          patientId: updateInsuranceGuideDto.patientId,
        }),
        ...(updateInsuranceGuideDto.specialtyId !== undefined && {
          specialtyId: updateInsuranceGuideDto.specialtyId,
        }),
        ...(updateInsuranceGuideDto.healthProfessionalId !== undefined && {
          healthProfessionalId: updateInsuranceGuideDto.healthProfessionalId,
        }),
        ...(updateInsuranceGuideDto.quantity !== undefined && {
          quantity: updateInsuranceGuideDto.quantity,
        }),
        ...(updateInsuranceGuideDto.expirationDate !== undefined && {
          expirationDate: new Date(updateInsuranceGuideDto.expirationDate),
        }),
      },
      include: guideInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.insuranceGuide.delete({
      where: { id },
      include: guideInclude,
    });
  }

  private defaultExpirationDate(submissionDeadlineDays: number): Date {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + submissionDeadlineDays);
    return date;
  }

  private async ensureHealthPlanExists(healthPlanId: number) {
    const healthPlan = await this.prisma.healthPlan.findUnique({
      where: { id: healthPlanId },
    });

    if (!healthPlan) {
      throw new NotFoundException(`Health plan ${healthPlanId} not found`);
    }

    return healthPlan;
  }

  private async ensurePatientExists(patientId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
  }

  private async ensureSpecialtyExists(specialtyId: number) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: specialtyId },
    });

    if (!specialty) {
      throw new NotFoundException(`Specialty ${specialtyId} not found`);
    }
  }

  private async ensureHealthProfessionalExists(healthProfessionalId: number) {
    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id: healthProfessionalId },
    });

    if (!professional) {
      throw new NotFoundException(
        `Health professional ${healthProfessionalId} not found`,
      );
    }
  }

  private async ensureProfessionalHasSpecialty(
    healthProfessionalId: number,
    specialtyId: number,
  ) {
    const link = await this.prisma.healthProfessionalSpecialty.findUnique({
      where: {
        healthProfessionalId_specialtyId: {
          healthProfessionalId,
          specialtyId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException(
        `Health professional ${healthProfessionalId} does not have specialty ${specialtyId}`,
      );
    }
  }
}

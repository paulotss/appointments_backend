import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInsuranceCardDto } from './dto/create-insurance-card.dto';
import { ListInsuranceCardsQueryDto } from './dto/list-insurance-cards-query.dto';
import { UpdateInsuranceCardDto } from './dto/update-insurance-card.dto';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

const cardInclude = {
  patient: true,
  healthPlan: true,
} as const;

@Injectable()
export class InsuranceCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInsuranceCardDto: CreateInsuranceCardDto) {
    await this.ensurePatientExists(createInsuranceCardDto.patientId);
    await this.ensureHealthPlanExists(createInsuranceCardDto.healthPlanId);
    await this.ensureUniqueCard(
      createInsuranceCardDto.patientId,
      createInsuranceCardDto.healthPlanId,
    );

    return this.prisma.insuranceCard.create({
      data: {
        patientId: createInsuranceCardDto.patientId,
        healthPlanId: createInsuranceCardDto.healthPlanId,
        cardNumber: digitsOnly(createInsuranceCardDto.cardNumber),
        expirationDate: new Date(createInsuranceCardDto.expirationDate),
      },
      include: cardInclude,
    });
  }

  findAll(query: ListInsuranceCardsQueryDto = {}) {
    return this.prisma.insuranceCard.findMany({
      where: {
        ...(query.patientId !== undefined && { patientId: query.patientId }),
      },
      orderBy: { id: 'asc' },
      include: cardInclude,
    });
  }

  async findOne(id: number) {
    const card = await this.prisma.insuranceCard.findUnique({
      where: { id },
      include: cardInclude,
    });

    if (!card) {
      throw new NotFoundException(`Insurance card ${id} not found`);
    }

    return card;
  }

  async update(id: number, updateInsuranceCardDto: UpdateInsuranceCardDto) {
    const existing = await this.findOne(id);

    if (updateInsuranceCardDto.patientId !== undefined) {
      await this.ensurePatientExists(updateInsuranceCardDto.patientId);
    }

    if (updateInsuranceCardDto.healthPlanId !== undefined) {
      await this.ensureHealthPlanExists(updateInsuranceCardDto.healthPlanId);
    }

    const nextPatientId = updateInsuranceCardDto.patientId ?? existing.patientId;
    const nextHealthPlanId =
      updateInsuranceCardDto.healthPlanId ?? existing.healthPlanId;
    await this.ensureUniqueCard(nextPatientId, nextHealthPlanId, id);

    return this.prisma.insuranceCard.update({
      where: { id },
      data: {
        ...(updateInsuranceCardDto.patientId !== undefined && {
          patientId: updateInsuranceCardDto.patientId,
        }),
        ...(updateInsuranceCardDto.healthPlanId !== undefined && {
          healthPlanId: updateInsuranceCardDto.healthPlanId,
        }),
        ...(updateInsuranceCardDto.cardNumber !== undefined && {
          cardNumber: digitsOnly(updateInsuranceCardDto.cardNumber),
        }),
        ...(updateInsuranceCardDto.expirationDate !== undefined && {
          expirationDate: new Date(updateInsuranceCardDto.expirationDate),
        }),
      },
      include: cardInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.insuranceCard.delete({
      where: { id },
      include: cardInclude,
    });
  }

  private async ensureUniqueCard(
    patientId: number,
    healthPlanId: number,
    excludeId?: number,
  ) {
    const existing = await this.prisma.insuranceCard.findFirst({
      where: {
        patientId,
        healthPlanId,
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'patient already has a card for this health plan',
      );
    }
  }

  private async ensurePatientExists(patientId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
  }

  private async ensureHealthPlanExists(healthPlanId: number) {
    const healthPlan = await this.prisma.healthPlan.findUnique({
      where: { id: healthPlanId },
    });

    if (!healthPlan) {
      throw new NotFoundException(`Health plan ${healthPlanId} not found`);
    }
  }
}

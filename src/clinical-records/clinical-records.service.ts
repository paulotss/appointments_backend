import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicalEvolutionDto } from './dto/create-clinical-evolution.dto';
import { UpdateClinicalEvolutionDto } from './dto/update-clinical-evolution.dto';
import { UpsertClinicalChartDto } from './dto/upsert-clinical-chart.dto';

const evolutionInclude = {
  healthProfessional: {
    select: {
      id: true,
      name: true,
      councilType: true,
      councilNumber: true,
      councilUf: true,
    },
  },
  clinicalAppointment: {
    select: { id: true, scheduledAt: true },
  },
} as const;

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class ClinicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async getChart(patientId: number) {
    await this.ensurePatient(patientId);
    const chart = await this.prisma.patientClinicalChart.findUnique({
      where: { patientId },
    });
    if (!chart) {
      return {
        id: null,
        patientId,
        allergies: null,
        chronicConditions: null,
        currentMedications: null,
        personalHistory: null,
        familyHistory: null,
        habits: null,
        updatedAt: null,
      };
    }
    return {
      id: chart.id,
      patientId: chart.patientId,
      allergies: chart.allergies,
      chronicConditions: chart.chronicConditions,
      currentMedications: chart.currentMedications,
      personalHistory: chart.personalHistory,
      familyHistory: chart.familyHistory,
      habits: chart.habits,
      updatedAt: chart.updatedAt,
    };
  }

  async upsertChart(
    patientId: number,
    dto: UpsertClinicalChartDto,
    user: JwtPayload,
  ) {
    await this.ensurePatient(patientId);
    const data = {
      allergies: blankToNull(dto.allergies),
      chronicConditions: blankToNull(dto.chronicConditions),
      currentMedications: blankToNull(dto.currentMedications),
      personalHistory: blankToNull(dto.personalHistory),
      familyHistory: blankToNull(dto.familyHistory),
      habits: blankToNull(dto.habits),
      updatedByUserId: user.sub,
    };
    const chart = await this.prisma.patientClinicalChart.upsert({
      where: { patientId },
      create: { patientId, ...data },
      update: data,
    });
    return this.getChart(chart.patientId);
  }

  async listEvolutions(patientId: number) {
    await this.ensurePatient(patientId);
    return this.prisma.clinicalEvolution.findMany({
      where: { patientId },
      include: evolutionInclude,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createEvolution(
    patientId: number,
    dto: CreateClinicalEvolutionDto,
    user: JwtPayload,
  ) {
    await this.ensurePatient(patientId);
    const healthProfessionalId = this.requireProfessionalId(user);
    await this.ensureAppointment(patientId, dto.clinicalAppointmentId);
    return this.prisma.clinicalEvolution.create({
      data: {
        patientId,
        healthProfessionalId,
        clinicalAppointmentId: dto.clinicalAppointmentId ?? null,
        occurredAt: new Date(dto.occurredAt),
        subjective: dto.subjective.trim(),
        objective: dto.objective.trim(),
        assessment: dto.assessment.trim(),
        plan: dto.plan.trim(),
      },
      include: evolutionInclude,
    });
  }

  async updateEvolution(
    patientId: number,
    evolutionId: number,
    dto: UpdateClinicalEvolutionDto,
    user: JwtPayload,
  ) {
    const healthProfessionalId = this.requireProfessionalId(user);
    const evolution = await this.prisma.clinicalEvolution.findFirst({
      where: { id: evolutionId, patientId },
    });
    if (!evolution) {
      throw new NotFoundException(
        `Clinical evolution ${evolutionId} not found`,
      );
    }
    if (evolution.healthProfessionalId !== healthProfessionalId) {
      throw new ForbiddenException(
        'Somente o autor pode alterar esta evolução.',
      );
    }
    if (dto.clinicalAppointmentId !== undefined) {
      await this.ensureAppointment(patientId, dto.clinicalAppointmentId);
    }
    return this.prisma.clinicalEvolution.update({
      where: { id: evolution.id },
      data: {
        ...(dto.occurredAt !== undefined && {
          occurredAt: new Date(dto.occurredAt),
        }),
        ...(dto.clinicalAppointmentId !== undefined && {
          clinicalAppointmentId: dto.clinicalAppointmentId ?? null,
        }),
        ...(dto.subjective !== undefined && {
          subjective: dto.subjective.trim(),
        }),
        ...(dto.objective !== undefined && { objective: dto.objective.trim() }),
        ...(dto.assessment !== undefined && {
          assessment: dto.assessment.trim(),
        }),
        ...(dto.plan !== undefined && { plan: dto.plan.trim() }),
      },
      include: evolutionInclude,
    });
  }

  private requireProfessionalId(user: JwtPayload): number {
    if (user.healthProfessionalId == null) {
      throw new ForbiddenException(
        'O usuário profissional não está vinculado a um cadastro de profissional.',
      );
    }
    return user.healthProfessionalId;
  }

  private async ensurePatient(patientId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
  }

  private async ensureAppointment(
    patientId: number,
    clinicalAppointmentId: number | null | undefined,
  ) {
    if (clinicalAppointmentId == null) return;
    const appointment = await this.prisma.clinicalAppointment.findFirst({
      where: { id: clinicalAppointmentId, patientId },
      select: { id: true },
    });
    if (!appointment) {
      throw new BadRequestException(
        'O agendamento não pertence a este paciente.',
      );
    }
  }
}

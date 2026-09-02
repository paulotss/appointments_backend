import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma, InsuranceGuideStatus } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import { InsuranceGuidesService } from '../insurance-guides/insurance-guides.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedFile } from '../uploads/uploaded-file';
import { CommitGuideImportDto } from './dto/commit-guide-import.dto';
import {
  digitsOnly,
  sanitizeExtractedGuide,
  type ExtractedGuide,
} from './extracted-guide';
import { GuideImportMatcher } from './guide-import.matcher';
import {
  GUIDE_VISION_PROVIDER,
  type GuideVisionProvider,
} from './guide-vision.provider';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const patientInclude = {
  insuranceCards: {
    include: { healthPlan: true },
    orderBy: { id: 'asc' as const },
  },
} as const;

@Injectable()
export class GuideImportsService {
  constructor(
    @Inject(GUIDE_VISION_PROVIDER)
    private readonly vision: GuideVisionProvider,
    private readonly matcher: GuideImportMatcher,
    private readonly prisma: PrismaService,
    private readonly insuranceGuidesService: InsuranceGuidesService,
  ) {}

  async analyze(file: UploadedFile | undefined) {
    this.assertFile(file);
    const extracted = await this.vision.extract({
      mimeType: file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype,
      buffer: file.buffer,
    });
    return this.matcher.match(extracted);
  }

  matchExtracted(raw: unknown) {
    return this.matcher.match(sanitizeExtractedGuide(raw));
  }

  async commit(dto: CommitGuideImportDto) {
    await this.assertPlanProfessionalAndProceduresExist(dto);

    return this.prisma.$transaction(async (tx) => {
      const patientId = await this.resolvePatient(tx, dto);
      return this.insuranceGuidesService.create(
        {
          healthPlanId: dto.healthPlanId,
          healthProfessionalId: dto.healthProfessionalId,
          patientId,
          procedures: dto.procedures,
          status: InsuranceGuideStatus.authorized,
          ...(dto.guideNumber !== undefined && {
            guideNumber: dto.guideNumber,
          }),
          ...(dto.authorizationDate !== undefined && {
            authorizationDate: dto.authorizationDate,
          }),
          ...(dto.expirationDate !== undefined && {
            expirationDate: dto.expirationDate,
          }),
        },
        tx,
      );
    });
  }

  private assertFile(
    file: UploadedFile | undefined,
  ): asserts file is UploadedFile {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPEG and PNG documents are allowed',
      );
    }
  }

  private async assertPlanProfessionalAndProceduresExist(
    dto: CommitGuideImportDto,
  ) {
    const healthPlan = await this.prisma.healthPlan.findUnique({
      where: { id: dto.healthPlanId },
    });
    if (!healthPlan) {
      throw new BadRequestException(
        'health plan was not found in the system; register it before importing',
      );
    }

    const professional = await this.prisma.healthProfessional.findUnique({
      where: { id: dto.healthProfessionalId },
    });
    if (!professional) {
      throw new BadRequestException(
        'health professional was not found in the system; register it before importing',
      );
    }

    const procedureIds = dto.procedures.map((item) => item.procedureId);
    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true },
    });
    if (procedures.length !== new Set(procedureIds).size) {
      throw new BadRequestException(
        'procedure was not found in the system; register it before importing',
      );
    }

    const priced = await this.prisma.healthPlanProcedure.findMany({
      where: {
        healthPlanId: dto.healthPlanId,
        procedureId: { in: procedureIds },
      },
      select: { procedureId: true },
    });
    if (priced.length !== new Set(procedureIds).size) {
      throw new BadRequestException(
        'procedure has no price for this health plan; register it before importing',
      );
    }
  }

  private async resolvePatient(
    tx: Prisma.TransactionClient,
    dto: CommitGuideImportDto,
  ): Promise<number> {
    if (dto.patient.mode === 'existing') {
      if (dto.patient.patientId == null) {
        throw new BadRequestException('patientId is required');
      }
      const patient = await tx.patient.findUnique({
        where: { id: dto.patient.patientId },
        include: patientInclude,
      });
      if (!patient) {
        throw new BadRequestException('Patient not found');
      }
      const hasCard = patient.insuranceCards.some(
        (card) => card.healthPlanId === dto.healthPlanId,
      );
      if (!hasCard) {
        await this.createCard(tx, {
          patientId: patient.id,
          healthPlanId: dto.healthPlanId,
          cardNumber: dto.patient.cardNumber,
          cardExpirationDate: dto.patient.cardExpirationDate,
        });
      }
      return patient.id;
    }

    if (!dto.patient.name || !dto.patient.phone) {
      throw new BadRequestException('patient name and phone are required');
    }

    const created = await tx.patient.create({
      data: {
        name: normalizeName(dto.patient.name),
        phone: dto.patient.phone,
        email: dto.patient.email,
        birthDate: dto.patient.birthDate
          ? new Date(dto.patient.birthDate)
          : null,
        cpf: dto.patient.cpf ? digitsOnly(dto.patient.cpf) : null,
      },
    });

    await this.createCard(tx, {
      patientId: created.id,
      healthPlanId: dto.healthPlanId,
      cardNumber: dto.patient.cardNumber,
      cardExpirationDate: dto.patient.cardExpirationDate,
    });

    return created.id;
  }

  private async createCard(
    tx: Prisma.TransactionClient,
    params: {
      patientId: number;
      healthPlanId: number;
      cardNumber?: string;
      cardExpirationDate?: string;
    },
  ) {
    if (!params.cardNumber || !params.cardExpirationDate) {
      throw new BadRequestException(
        'insurance card number and expiration date are required',
      );
    }

    await tx.insuranceCard.create({
      data: {
        patientId: params.patientId,
        healthPlanId: params.healthPlanId,
        cardNumber: digitsOnly(params.cardNumber),
        expirationDate: new Date(params.cardExpirationDate),
      },
    });
  }
}

export type { ExtractedGuide };

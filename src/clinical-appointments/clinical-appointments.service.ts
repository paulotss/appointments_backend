import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
  Prisma,
} from '@prisma/client';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicalAppointmentDto } from './dto/create-clinical-appointment.dto';
import { ListClinicalAppointmentsQueryDto } from './dto/list-clinical-appointments-query.dto';
import { UpdateClinicalAppointmentDto } from './dto/update-clinical-appointment.dto';

const appointmentInclude = {
  patient: true,
  healthProfessional: true,
  insuranceGuides: {
    include: {
      insuranceGuide: {
        include: {
          healthPlan: true,
          procedures: {
            include: { procedure: { include: { healthPlanPrices: true } } },
          },
        },
      },
    },
  },
  procedures: { include: { procedure: true } },
} as const;

const guideForAppointmentInclude = {
  procedures: { include: { procedure: true } },
  billingBatchGuide: true,
} as const;

type GuideForAppointment = Prisma.InsuranceGuideGetPayload<{
  include: typeof guideForAppointmentInclude;
}>;

@Injectable()
export class ClinicalAppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateClinicalAppointmentDto) {
    await this.ensurePatientExists(createDto.patientId);
    await this.ensureHealthProfessionalExists(createDto.healthProfessionalId);

    const status = createDto.status ?? ClinicalAppointmentStatus.marked;
    const scheduledAt = new Date(createDto.scheduledAt);
    const endsAt = new Date(createDto.endsAt);
    this.ensureValidInterval(scheduledAt, endsAt);

    if (createDto.type === ClinicalAppointmentType.private) {
      if (createDto.insuranceGuideIds !== undefined) {
        throw new BadRequestException(
          'insuranceGuideIds must be omitted when type is private',
        );
      }

      const procedureIds = this.uniqueIds(
        createDto.procedureIds,
        'procedureIds is required when type is private',
      );
      await this.ensurePrivateProceduresValid(
        createDto.healthProfessionalId,
        procedureIds,
      );

      return this.prisma.clinicalAppointment.create({
        data: {
          patientId: createDto.patientId,
          healthProfessionalId: createDto.healthProfessionalId,
          scheduledAt,
          endsAt,
          status,
          type: ClinicalAppointmentType.private,
          notes: createDto.notes,
          procedures: {
            create: procedureIds.map((procedureId) => ({ procedureId })),
          },
        },
        include: appointmentInclude,
      });
    }

    const insuranceGuideIds = this.uniqueIds(
      createDto.insuranceGuideIds,
      'insuranceGuideIds is required when type is health_plan',
    );

    if (createDto.procedureIds !== undefined) {
      throw new BadRequestException(
        'procedureIds must be omitted when type is health_plan; procedures are copied from the insurance guides',
      );
    }

    const guides = await this.loadAndValidateGuides({
      insuranceGuideIds,
      patientId: createDto.patientId,
      healthProfessionalId: createDto.healthProfessionalId,
    });
    const procedureIds = this.procedureIdsFromGuides(guides);

    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.clinicalAppointment.create({
        data: {
          patientId: createDto.patientId,
          healthProfessionalId: createDto.healthProfessionalId,
          scheduledAt,
          endsAt,
          status,
          type: ClinicalAppointmentType.health_plan,
          notes: createDto.notes,
          insuranceGuides: {
            create: insuranceGuideIds.map((insuranceGuideId) => ({
              insuranceGuideId,
            })),
          },
          procedures: {
            create: procedureIds.map((procedureId) => ({ procedureId })),
          },
        },
        include: appointmentInclude,
      });

      if (status === ClinicalAppointmentStatus.finished) {
        await this.consumeGuides(tx, guides);
      }

      return tx.clinicalAppointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: appointmentInclude,
      });
    });
  }

  findAll(query: ListClinicalAppointmentsQueryDto) {
    const scheduledAtFilter =
      query.from !== undefined || query.to !== undefined
        ? {
            ...(query.from !== undefined && {
              gte: startOfDaySaoPaulo(query.from.slice(0, 10)),
            }),
            ...(query.to !== undefined && {
              lte: endOfDaySaoPaulo(query.to.slice(0, 10)),
            }),
          }
        : undefined;

    return this.prisma.clinicalAppointment.findMany({
      where: {
        ...(query.patientId !== undefined && { patientId: query.patientId }),
        ...(query.healthProfessionalId !== undefined && {
          healthProfessionalId: query.healthProfessionalId,
        }),
        ...(query.status !== undefined && { status: query.status }),
        ...(query.type !== undefined && { type: query.type }),
        ...(query.insuranceGuideId !== undefined && {
          insuranceGuides: {
            some: { insuranceGuideId: query.insuranceGuideId },
          },
        }),
        ...(scheduledAtFilter !== undefined && {
          scheduledAt: scheduledAtFilter,
        }),
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      include: appointmentInclude,
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.clinicalAppointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });

    if (!appointment) {
      throw new NotFoundException(`Clinical appointment ${id} not found`);
    }

    return appointment;
  }

  async update(id: number, updateDto: UpdateClinicalAppointmentDto) {
    const existing = await this.findOne(id);

    const nextPatientId = updateDto.patientId ?? existing.patientId;
    const nextProfessionalId =
      updateDto.healthProfessionalId ?? existing.healthProfessionalId;
    const nextType = updateDto.type ?? existing.type;
    const nextStatus = updateDto.status ?? existing.status;
    const nextScheduledAt =
      updateDto.scheduledAt !== undefined
        ? new Date(updateDto.scheduledAt)
        : existing.scheduledAt;
    const nextEndsAt =
      updateDto.endsAt !== undefined
        ? new Date(updateDto.endsAt)
        : existing.endsAt;
    this.ensureValidInterval(nextScheduledAt, nextEndsAt);

    if (updateDto.patientId !== undefined) {
      await this.ensurePatientExists(updateDto.patientId);
    }

    if (updateDto.healthProfessionalId !== undefined) {
      await this.ensureHealthProfessionalExists(updateDto.healthProfessionalId);
    }

    const existingGuideIds = existing.insuranceGuides.map(
      (item) => item.insuranceGuideId,
    );
    const nextGuideIds = this.resolveNextGuideIds(
      existingGuideIds,
      updateDto,
      nextType,
    );
    const nextGuides =
      nextType === ClinicalAppointmentType.health_plan
        ? await this.loadAndValidateGuides({
            insuranceGuideIds: nextGuideIds,
            patientId: nextPatientId,
            healthProfessionalId: nextProfessionalId,
            alreadyAssociatedIds: existingGuideIds,
          })
        : [];

    const nextProcedureIds = await this.resolveNextProcedureIds({
      existingType: existing.type,
      existingGuideIds,
      existingProcedureIds: existing.procedures.map((item) => item.procedureId),
      nextType,
      nextGuideIds,
      nextGuides,
      nextProfessionalId,
      updateDto,
    });

    const existingGuidesForConsume = existing.insuranceGuides.map(
      (item) => item.insuranceGuide,
    );
    const oldConsumeKey = this.consumeKey(
      existing.type,
      existingGuidesForConsume,
      existing.status,
    );
    const nextConsumeKey = this.consumeKey(nextType, nextGuides, nextStatus);

    return this.prisma.$transaction(async (tx) => {
      if (oldConsumeKey && oldConsumeKey !== nextConsumeKey) {
        await this.releaseGuides(tx, existingGuidesForConsume);
      }

      await tx.clinicalAppointmentProcedure.deleteMany({
        where: { clinicalAppointmentId: id },
      });
      await tx.clinicalAppointmentProcedure.createMany({
        data: nextProcedureIds.map((procedureId) => ({
          clinicalAppointmentId: id,
          procedureId,
        })),
      });

      await tx.clinicalAppointmentGuide.deleteMany({
        where: { clinicalAppointmentId: id },
      });
      if (nextGuideIds.length > 0) {
        await tx.clinicalAppointmentGuide.createMany({
          data: nextGuideIds.map((insuranceGuideId) => ({
            clinicalAppointmentId: id,
            insuranceGuideId,
          })),
        });
      }

      await tx.clinicalAppointment.update({
        where: { id },
        data: {
          patientId: nextPatientId,
          healthProfessionalId: nextProfessionalId,
          scheduledAt: nextScheduledAt,
          endsAt: nextEndsAt,
          status: nextStatus,
          type: nextType,
          ...(updateDto.notes !== undefined && { notes: updateDto.notes }),
        },
      });

      if (nextConsumeKey && oldConsumeKey !== nextConsumeKey) {
        await this.consumeGuides(tx, nextGuides);
      }

      return tx.clinicalAppointment.findUniqueOrThrow({
        where: { id },
        include: appointmentInclude,
      });
    });
  }

  async remove(id: number) {
    const existing = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const key = this.consumeKey(
        existing.type,
        existing.insuranceGuides.map((item) => item.insuranceGuide),
        existing.status,
      );
      if (key) {
        await this.releaseGuides(
          tx,
          existing.insuranceGuides.map((item) => item.insuranceGuide),
        );
      }

      return tx.clinicalAppointment.delete({
        where: { id },
        include: appointmentInclude,
      });
    });
  }

  private resolveNextGuideIds(
    existingGuideIds: number[],
    updateDto: UpdateClinicalAppointmentDto,
    nextType: ClinicalAppointmentType,
  ): number[] {
    if (nextType === ClinicalAppointmentType.private) {
      if (updateDto.insuranceGuideIds !== undefined) {
        throw new BadRequestException(
          'insuranceGuideIds must be omitted when type is private',
        );
      }
      return [];
    }

    if (updateDto.insuranceGuideIds !== undefined) {
      return this.uniqueIds(
        updateDto.insuranceGuideIds,
        'insuranceGuideIds is required when type is health_plan',
      );
    }

    if (existingGuideIds.length === 0) {
      throw new BadRequestException(
        'insuranceGuideIds is required when type is health_plan',
      );
    }

    return existingGuideIds;
  }

  private async resolveNextProcedureIds(params: {
    existingType: ClinicalAppointmentType;
    existingGuideIds: number[];
    existingProcedureIds: number[];
    nextType: ClinicalAppointmentType;
    nextGuideIds: number[];
    nextGuides: GuideForAppointment[];
    nextProfessionalId: number;
    updateDto: UpdateClinicalAppointmentDto;
  }): Promise<number[]> {
    if (params.nextType === ClinicalAppointmentType.private) {
      if (params.updateDto.procedureIds !== undefined) {
        const procedureIds = this.uniqueIds(
          params.updateDto.procedureIds,
          'procedureIds is required when type is private',
        );
        await this.ensurePrivateProceduresValid(
          params.nextProfessionalId,
          procedureIds,
        );
        return procedureIds;
      }

      if (params.existingType !== ClinicalAppointmentType.private) {
        throw new BadRequestException(
          'procedureIds is required when changing type to private',
        );
      }

      if (params.existingProcedureIds.length === 0) {
        throw new BadRequestException(
          'procedureIds is required when type is private',
        );
      }

      await this.ensurePrivateProceduresValid(
        params.nextProfessionalId,
        params.existingProcedureIds,
      );
      return params.existingProcedureIds;
    }

    if (params.updateDto.procedureIds !== undefined) {
      throw new BadRequestException(
        'procedureIds must be omitted when type is health_plan; procedures are copied from the insurance guides',
      );
    }

    const shouldCopyFromGuides =
      params.existingType !== ClinicalAppointmentType.health_plan ||
      !this.sameIdSet(params.existingGuideIds, params.nextGuideIds);

    if (shouldCopyFromGuides) {
      return this.procedureIdsFromGuides(params.nextGuides);
    }

    return params.existingProcedureIds;
  }

  private consumeKey(
    type: ClinicalAppointmentType,
    guides: Array<{ id: number; procedures: Array<{ procedureId: number }> }>,
    status: ClinicalAppointmentStatus,
  ): string | null {
    if (
      type !== ClinicalAppointmentType.health_plan ||
      status !== ClinicalAppointmentStatus.finished ||
      guides.length === 0
    ) {
      return null;
    }

    return guides
      .map((guide) => {
        const procedureIds = guide.procedures
          .map((item) => item.procedureId)
          .sort((a, b) => a - b);
        return `${guide.id}:${procedureIds.join(',')}`;
      })
      .sort()
      .join('|');
  }

  private ensureValidInterval(scheduledAt: Date, endsAt: Date) {
    if (endsAt.getTime() <= scheduledAt.getTime()) {
      throw new BadRequestException('endsAt must be after scheduledAt');
    }
  }

  private uniqueIds(
    ids: number[] | undefined,
    requiredMessage: string,
  ): number[] {
    if (!ids?.length) {
      throw new BadRequestException(requiredMessage);
    }

    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException('IDs cannot contain duplicates');
    }

    return unique;
  }

  private sameIdSet(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    const rightSet = new Set(right);
    return left.every((id) => rightSet.has(id));
  }

  private procedureIdsFromGuides(guides: GuideForAppointment[]): number[] {
    return [
      ...new Set(
        guides.flatMap((guide) =>
          guide.procedures.map((item) => item.procedureId),
        ),
      ),
    ];
  }

  private async ensurePrivateProceduresValid(
    healthProfessionalId: number,
    procedureIds: number[],
  ) {
    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true, specialtyId: true },
    });

    if (procedures.length !== procedureIds.length) {
      const found = new Set(procedures.map((item) => item.id));
      const missing = procedureIds.find((id) => !found.has(id));
      throw new NotFoundException(`Procedure ${missing} not found`);
    }

    const links = await this.prisma.healthProfessionalSpecialty.findMany({
      where: { healthProfessionalId },
      select: { specialtyId: true },
    });
    const allowed = new Set(links.map((item) => item.specialtyId));

    for (const procedure of procedures) {
      if (!allowed.has(procedure.specialtyId)) {
        throw new NotFoundException(
          `Health professional ${healthProfessionalId} does not have specialty ${procedure.specialtyId} required by procedure ${procedure.id}`,
        );
      }
    }
  }

  private async loadAndValidateGuides(params: {
    insuranceGuideIds: number[];
    patientId: number;
    healthProfessionalId: number;
    alreadyAssociatedIds?: number[];
  }): Promise<GuideForAppointment[]> {
    const alreadyAssociated = new Set(params.alreadyAssociatedIds ?? []);
    const guides = await this.prisma.insuranceGuide.findMany({
      where: { id: { in: params.insuranceGuideIds } },
      include: guideForAppointmentInclude,
    });

    if (guides.length !== params.insuranceGuideIds.length) {
      const found = new Set(guides.map((guide) => guide.id));
      const missing = params.insuranceGuideIds.find((id) => !found.has(id));
      throw new NotFoundException(`Insurance guide ${missing} not found`);
    }

    for (const guide of guides) {
      if (guide.patientId !== params.patientId) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} does not belong to patient ${params.patientId}`,
        );
      }

      if (guide.healthProfessionalId !== params.healthProfessionalId) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} does not belong to health professional ${params.healthProfessionalId}`,
        );
      }

      const isNewAssociation = !alreadyAssociated.has(guide.id);

      if (isNewAssociation && guide.isBilled) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} is already billed`,
        );
      }

      if (isNewAssociation && guide.billingBatchGuide) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} is already in a billing batch`,
        );
      }

      if (guide.procedures.length === 0) {
        throw new BadRequestException(
          `Insurance guide ${guide.id} has no procedures`,
        );
      }
    }

    return guides.sort((a, b) => a.id - b.id);
  }

  private async consumeGuides(
    tx: Prisma.TransactionClient,
    guides: GuideForAppointment[],
  ) {
    for (const guide of guides) {
      await this.consumeGuideProcedures(
        tx,
        guide.id,
        guide.procedures.map((item) => item.procedureId),
      );
    }
  }

  private async releaseGuides(
    tx: Prisma.TransactionClient,
    guides: Array<{ id: number; procedures: Array<{ procedureId: number }> }>,
  ) {
    for (const guide of guides) {
      await this.releaseGuideProcedures(
        tx,
        guide.id,
        guide.procedures.map((item) => item.procedureId),
      );
    }
  }

  private async consumeGuideProcedures(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    procedureIds: number[],
  ) {
    for (const procedureId of procedureIds) {
      const rows = await tx.$executeRaw`
        UPDATE "insurance_guide_procedures"
        SET "used_quantity" = "used_quantity" + 1
        WHERE "insurance_guide_id" = ${insuranceGuideId}
          AND "procedure_id" = ${procedureId}
          AND "used_quantity" < "authorized_quantity"
      `;

      if (rows === 0) {
        throw new BadRequestException(
          `Procedure ${procedureId} has no remaining quantity on insurance guide ${insuranceGuideId}`,
        );
      }
    }
  }

  private async releaseGuideProcedures(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    procedureIds: number[],
  ) {
    for (const procedureId of procedureIds) {
      await tx.$executeRaw`
        UPDATE "insurance_guide_procedures"
        SET "used_quantity" = "used_quantity" - 1
        WHERE "insurance_guide_id" = ${insuranceGuideId}
          AND "procedure_id" = ${procedureId}
          AND "used_quantity" > 0
      `;
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
}

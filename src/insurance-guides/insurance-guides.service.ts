import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInsuranceGuideDto } from './dto/create-insurance-guide.dto';
import { InsuranceGuideProcedureInputDto } from './dto/insurance-guide-procedure-input.dto';
import { ListInsuranceGuidesQueryDto } from './dto/list-insurance-guides-query.dto';
import { UpdateInsuranceGuideDto } from './dto/update-insurance-guide.dto';

const guideInclude = {
  healthPlan: true,
  patient: true,
  healthProfessional: true,
  procedures: {
    include: {
      procedure: { include: { specialty: true, healthPlanPrices: true } },
    },
  },
} as const;

@Injectable()
export class InsuranceGuidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInsuranceGuideDto: CreateInsuranceGuideDto) {
    const healthPlan = await this.ensureHealthPlanExists(
      createInsuranceGuideDto.healthPlanId,
    );
    await this.ensurePatientExists(createInsuranceGuideDto.patientId);
    await this.ensureHealthProfessionalExists(
      createInsuranceGuideDto.healthProfessionalId,
    );
    const procedureValues = await this.ensureGuideProceduresValid({
      healthPlanId: createInsuranceGuideDto.healthPlanId,
      healthProfessionalId: createInsuranceGuideDto.healthProfessionalId,
      procedures: createInsuranceGuideDto.procedures,
    });

    const expirationDate =
      createInsuranceGuideDto.expirationDate !== undefined
        ? new Date(createInsuranceGuideDto.expirationDate)
        : this.defaultExpirationDate(healthPlan.submissionDeadlineDays);

    return this.prisma.insuranceGuide.create({
      data: {
        healthPlanId: createInsuranceGuideDto.healthPlanId,
        patientId: createInsuranceGuideDto.patientId,
        healthProfessionalId: createInsuranceGuideDto.healthProfessionalId,
        expirationDate,
        ...(createInsuranceGuideDto.status !== undefined && {
          status: createInsuranceGuideDto.status,
        }),
        procedures: {
          create: createInsuranceGuideDto.procedures.map((item) => ({
            procedureId: item.procedureId,
            authorizedQuantity: item.authorizedQuantity,
            value: item.value ?? procedureValues.get(item.procedureId)!,
          })),
        },
      },
      include: guideInclude,
    });
  }

  async findAll(
    query: ListInsuranceGuidesQueryDto,
  ): Promise<
    ListEnvelope<
      Prisma.InsuranceGuideGetPayload<{ include: typeof guideInclude }>
    >
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.InsuranceGuideWhereInput = {
      ...(query.isBilled !== undefined && { isBilled: query.isBilled }),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.patientId !== undefined && { patientId: query.patientId }),
      ...(query.healthProfessionalId !== undefined && {
        healthProfessionalId: query.healthProfessionalId,
      }),
      ...(query.healthPlanId !== undefined && {
        healthPlanId: query.healthPlanId,
      }),
      ...(query.availableForBilling === true && {
        isBilled: false,
        billingBatchGuide: { is: null },
        procedures: { some: { usedQuantity: { gt: 0 } } },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.insuranceGuide.findMany({
        where,
        orderBy: { id: 'asc' },
        include: guideInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.insuranceGuide.count({ where }),
    ]);

    return {
      data,
      meta: buildListMeta(page, limit, total),
    };
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

    if (updateInsuranceGuideDto.healthProfessionalId !== undefined) {
      await this.ensureHealthProfessionalExists(
        updateInsuranceGuideDto.healthProfessionalId,
      );
    }

    const healthPlanId =
      updateInsuranceGuideDto.healthPlanId ?? existing.healthPlanId;
    const healthProfessionalId =
      updateInsuranceGuideDto.healthProfessionalId ??
      existing.healthProfessionalId;
    const procedures =
      updateInsuranceGuideDto.procedures ??
      existing.procedures.map((item) => ({
        procedureId: item.procedureId,
        authorizedQuantity: item.authorizedQuantity,
      }));

    const shouldRevalidateProcedures =
      updateInsuranceGuideDto.procedures !== undefined ||
      updateInsuranceGuideDto.healthPlanId !== undefined ||
      updateInsuranceGuideDto.healthProfessionalId !== undefined;

    let procedureValues = new Map<number, Prisma.Decimal>();
    if (shouldRevalidateProcedures) {
      procedureValues = await this.ensureGuideProceduresValid({
        healthPlanId,
        healthProfessionalId,
        procedures,
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (updateInsuranceGuideDto.procedures !== undefined) {
          await this.syncGuideProcedures(
            tx,
            id,
            existing.procedures,
            updateInsuranceGuideDto.procedures,
            procedureValues,
          );
        }

        if (
          updateInsuranceGuideDto.healthPlanId !== undefined &&
          updateInsuranceGuideDto.healthPlanId !== existing.healthPlanId
        ) {
          await this.refreshGuideProcedureValues(
            tx,
            id,
            procedures.map((item) => item.procedureId),
            procedureValues,
          );
        }

        return tx.insuranceGuide.update({
          where: { id },
          data: {
            ...(updateInsuranceGuideDto.healthPlanId !== undefined && {
              healthPlanId: updateInsuranceGuideDto.healthPlanId,
            }),
            ...(updateInsuranceGuideDto.patientId !== undefined && {
              patientId: updateInsuranceGuideDto.patientId,
            }),
            ...(updateInsuranceGuideDto.healthProfessionalId !== undefined && {
              healthProfessionalId:
                updateInsuranceGuideDto.healthProfessionalId,
            }),
            ...(updateInsuranceGuideDto.expirationDate !== undefined && {
              expirationDate: new Date(updateInsuranceGuideDto.expirationDate),
            }),
            ...(updateInsuranceGuideDto.status !== undefined && {
              status: updateInsuranceGuideDto.status,
            }),
          },
          include: guideInclude,
        });
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.prisma.insuranceGuide.delete({
        where: { id },
        include: guideInclude,
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  private async syncGuideProcedures(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    existing: Array<{
      procedureId: number;
      authorizedQuantity: number;
      usedQuantity: number;
    }>,
    incoming: InsuranceGuideProcedureInputDto[],
    procedureValues: Map<number, Prisma.Decimal>,
  ) {
    const existingByProcedureId = new Map(
      existing.map((item) => [item.procedureId, item]),
    );
    const incomingIds = new Set(incoming.map((item) => item.procedureId));

    for (const current of existing) {
      if (!incomingIds.has(current.procedureId)) {
        if (current.usedQuantity > 0) {
          throw new BadRequestException(
            `Cannot remove procedure ${current.procedureId} from insurance guide because usedQuantity is ${current.usedQuantity}`,
          );
        }

        await tx.insuranceGuideProcedure.delete({
          where: {
            insuranceGuideId_procedureId: {
              insuranceGuideId,
              procedureId: current.procedureId,
            },
          },
        });
      }
    }

    for (const item of incoming) {
      const current = existingByProcedureId.get(item.procedureId);
      if (!current) {
        await tx.insuranceGuideProcedure.create({
          data: {
            insuranceGuideId,
            procedureId: item.procedureId,
            authorizedQuantity: item.authorizedQuantity,
            value: item.value ?? procedureValues.get(item.procedureId)!,
          },
        });
        continue;
      }

      if (item.authorizedQuantity < current.usedQuantity) {
        throw new BadRequestException(
          `authorizedQuantity for procedure ${item.procedureId} cannot be less than usedQuantity ${current.usedQuantity}`,
        );
      }

      const data: {
        authorizedQuantity?: number;
        value?: number;
      } = {};

      if (item.authorizedQuantity !== current.authorizedQuantity) {
        data.authorizedQuantity = item.authorizedQuantity;
      }

      if (item.value !== undefined) {
        data.value = item.value;
      }

      if (Object.keys(data).length > 0) {
        await tx.insuranceGuideProcedure.update({
          where: {
            insuranceGuideId_procedureId: {
              insuranceGuideId,
              procedureId: item.procedureId,
            },
          },
          data,
        });
      }
    }
  }

  private async refreshGuideProcedureValues(
    tx: Prisma.TransactionClient,
    insuranceGuideId: number,
    procedureIds: number[],
    procedureValues: Map<number, Prisma.Decimal>,
  ) {
    for (const procedureId of procedureIds) {
      const value = procedureValues.get(procedureId);
      if (value === undefined) {
        continue;
      }

      await tx.insuranceGuideProcedure.update({
        where: {
          insuranceGuideId_procedureId: {
            insuranceGuideId,
            procedureId,
          },
        },
        data: { value },
      });
    }
  }

  private async ensureGuideProceduresValid(params: {
    healthPlanId: number;
    healthProfessionalId: number;
    procedures: InsuranceGuideProcedureInputDto[];
  }): Promise<Map<number, Prisma.Decimal>> {
    const procedureIds = params.procedures.map((item) => item.procedureId);
    const uniqueIds = new Set(procedureIds);
    if (uniqueIds.size !== procedureIds.length) {
      throw new BadRequestException(
        'procedures cannot contain duplicate procedureId',
      );
    }

    const dbProcedures = await this.prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true, specialtyId: true },
    });

    if (dbProcedures.length !== uniqueIds.size) {
      const found = new Set(dbProcedures.map((item) => item.id));
      const missing = procedureIds.find((id) => !found.has(id));
      throw new NotFoundException(`Procedure ${missing} not found`);
    }

    const professionalSpecialties =
      await this.prisma.healthProfessionalSpecialty.findMany({
        where: { healthProfessionalId: params.healthProfessionalId },
        select: { specialtyId: true },
      });
    const allowedSpecialtyIds = new Set(
      professionalSpecialties.map((item) => item.specialtyId),
    );

    for (const procedure of dbProcedures) {
      if (!allowedSpecialtyIds.has(procedure.specialtyId)) {
        throw new NotFoundException(
          `Health professional ${params.healthProfessionalId} does not have specialty ${procedure.specialtyId} required by procedure ${procedure.id}`,
        );
      }
    }

    const priced = await this.prisma.healthPlanProcedure.findMany({
      where: {
        healthPlanId: params.healthPlanId,
        procedureId: { in: procedureIds },
      },
      select: { procedureId: true, value: true },
    });
    const pricedIds = new Set(priced.map((item) => item.procedureId));
    const withoutPrice = procedureIds.find((id) => !pricedIds.has(id));
    if (withoutPrice !== undefined) {
      throw new BadRequestException(
        `Procedure ${withoutPrice} has no price for health plan ${params.healthPlanId}`,
      );
    }

    return new Map(priced.map((item) => [item.procedureId, item.value]));
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

  private rethrowKnownPrismaError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(
        'Insurance guide cannot be removed because it is in use',
      );
    }
  }
}

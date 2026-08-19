import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { HealthPlanPriceInputDto } from './dto/health-plan-price-input.dto';
import { ListProceduresQueryDto } from './dto/list-procedures-query.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';

const procedureInclude = {
  specialty: true,
  healthPlanPrices: {
    include: { healthPlan: true },
  },
} as const;

@Injectable()
export class ProceduresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProcedureDto: CreateProcedureDto) {
    await this.ensureSpecialtyExists(createProcedureDto.specialtyId);
    await this.ensureHealthPlanPricesValid(createProcedureDto.healthPlanPrices);

    try {
      return await this.prisma.procedure.create({
        data: {
          specialtyId: createProcedureDto.specialtyId,
          tissCode: this.normalizeTissCode(createProcedureDto.tissCode),
          name: normalizeName(createProcedureDto.name),
          value: createProcedureDto.value,
          ...(createProcedureDto.healthPlanPrices !== undefined && {
            healthPlanPrices: {
              create: createProcedureDto.healthPlanPrices.map((item) => ({
                healthPlanId: item.healthPlanId,
                value: item.value,
              })),
            },
          }),
        },
        include: procedureInclude,
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  findAll(query: ListProceduresQueryDto) {
    return this.prisma.procedure.findMany({
      where: {
        ...(query.specialtyId !== undefined && {
          specialtyId: query.specialtyId,
        }),
        ...(query.healthPlanId !== undefined && {
          healthPlanPrices: {
            some: { healthPlanId: query.healthPlanId },
          },
        }),
      },
      orderBy: { id: 'asc' },
      include: procedureInclude,
    });
  }

  async findOne(id: number) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id },
      include: procedureInclude,
    });

    if (!procedure) {
      throw new NotFoundException(`Procedure ${id} not found`);
    }

    return procedure;
  }

  async update(id: number, updateProcedureDto: UpdateProcedureDto) {
    await this.findOne(id);

    if (updateProcedureDto.specialtyId !== undefined) {
      await this.ensureSpecialtyExists(updateProcedureDto.specialtyId);
    }

    if (updateProcedureDto.healthPlanPrices !== undefined) {
      await this.ensureHealthPlanPricesValid(
        updateProcedureDto.healthPlanPrices,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (updateProcedureDto.healthPlanPrices !== undefined) {
          await tx.healthPlanProcedure.deleteMany({
            where: { procedureId: id },
          });
        }

        return tx.procedure.update({
          where: { id },
          data: {
            ...(updateProcedureDto.specialtyId !== undefined && {
              specialtyId: updateProcedureDto.specialtyId,
            }),
            ...(updateProcedureDto.tissCode !== undefined && {
              tissCode: this.normalizeTissCode(updateProcedureDto.tissCode),
            }),
            ...(updateProcedureDto.name !== undefined && {
              name: normalizeName(updateProcedureDto.name),
            }),
            ...(updateProcedureDto.value !== undefined && {
              value: updateProcedureDto.value,
            }),
            ...(updateProcedureDto.healthPlanPrices !== undefined && {
              healthPlanPrices: {
                create: updateProcedureDto.healthPlanPrices.map((item) => ({
                  healthPlanId: item.healthPlanId,
                  value: item.value,
                })),
              },
            }),
          },
          include: procedureInclude,
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
      return await this.prisma.procedure.delete({
        where: { id },
        include: procedureInclude,
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
      throw error;
    }
  }

  private normalizeTissCode(tissCode: string): string {
    return tissCode.trim();
  }

  private async ensureSpecialtyExists(specialtyId: number) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: specialtyId },
    });

    if (!specialty) {
      throw new NotFoundException(`Specialty ${specialtyId} not found`);
    }
  }

  private async ensureHealthPlanPricesValid(
    healthPlanPrices?: HealthPlanPriceInputDto[],
  ) {
    if (!healthPlanPrices?.length) {
      return;
    }

    const healthPlanIds = healthPlanPrices.map((item) => item.healthPlanId);
    const uniqueIds = new Set(healthPlanIds);
    if (uniqueIds.size !== healthPlanIds.length) {
      throw new BadRequestException(
        'healthPlanPrices cannot contain duplicate healthPlanId',
      );
    }

    const plans = await this.prisma.healthPlan.findMany({
      where: { id: { in: healthPlanIds } },
      select: { id: true },
    });

    if (plans.length !== uniqueIds.size) {
      const found = new Set(plans.map((plan) => plan.id));
      const missing = healthPlanIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Health plan ${missing[0]} not found`);
    }
  }

  private rethrowKnownPrismaError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('tissCode already exists');
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(
        'Procedure cannot be removed because it is in use',
      );
    }
  }
}

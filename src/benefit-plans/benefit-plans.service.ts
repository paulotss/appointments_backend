import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BenefitKind, Prisma } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { BenefitInputDto } from './dto/benefit-input.dto';
import { CreateBenefitPlanDto } from './dto/create-benefit-plan.dto';
import { ListBenefitPlansQueryDto } from './dto/list-benefit-plans-query.dto';
import { UpdateBenefitPlanDto } from './dto/update-benefit-plan.dto';

const benefitPlanInclude = {
  benefits: {
    include: {
      procedures: { include: { procedure: true } },
    },
    orderBy: { id: 'asc' as const },
  },
} as const;

@Injectable()
export class BenefitPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBenefitPlanDto) {
    await this.ensureBenefitsValid(dto.benefits);

    return this.prisma.benefitPlan.create({
      data: {
        name: normalizeName(dto.name),
        annualPrice: dto.annualPrice,
        adhesionFee: dto.adhesionFee ?? 20,
        dependentFee: dto.dependentFee ?? 5,
        isActive: dto.isActive ?? true,
        benefits: {
          create: dto.benefits.map((benefit) => this.benefitCreate(benefit)),
        },
      },
      include: benefitPlanInclude,
    });
  }

  findAll(query: ListBenefitPlansQueryDto) {
    return this.prisma.benefitPlan.findMany({
      where: {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
      },
      orderBy: { id: 'asc' },
      include: benefitPlanInclude,
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.benefitPlan.findUnique({
      where: { id },
      include: benefitPlanInclude,
    });
    if (!item) {
      throw new NotFoundException(`Benefit plan ${id} not found`);
    }
    return item;
  }

  async update(id: number, dto: UpdateBenefitPlanDto) {
    await this.findOne(id);
    if (dto.benefits !== undefined) {
      await this.ensureBenefitsValid(dto.benefits);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.benefits !== undefined) {
          await tx.benefit.deleteMany({ where: { planId: id } });
        }

        return tx.benefitPlan.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: normalizeName(dto.name) }),
            ...(dto.annualPrice !== undefined && {
              annualPrice: dto.annualPrice,
            }),
            ...(dto.adhesionFee !== undefined && {
              adhesionFee: dto.adhesionFee,
            }),
            ...(dto.dependentFee !== undefined && {
              dependentFee: dto.dependentFee,
            }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.benefits !== undefined && {
              benefits: {
                create: dto.benefits.map((benefit) =>
                  this.benefitCreate(benefit),
                ),
              },
            }),
          },
          include: benefitPlanInclude,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Benefit plan benefits cannot be replaced because a subscription still references them',
        );
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      return await this.prisma.benefitPlan.delete({
        where: { id },
        include: benefitPlanInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Benefit plan cannot be removed because it has subscriptions',
        );
      }
      throw error;
    }
  }

  private benefitCreate(
    benefit: BenefitInputDto,
  ): Prisma.BenefitCreateWithoutPlanInput {
    return {
      title: benefit.title.trim(),
      description: benefit.description?.trim() || null,
      kind: benefit.kind,
      quantity: benefit.kind === BenefitKind.quota ? benefit.quantity : null,
      discountPercent:
        benefit.kind === BenefitKind.discount ? benefit.discountPercent : null,
      ...(benefit.kind === BenefitKind.quota && {
        procedures: {
          create: (benefit.procedureIds ?? []).map((procedureId) => ({
            procedureId,
          })),
        },
      }),
    };
  }

  private async ensureBenefitsValid(benefits: BenefitInputDto[]) {
    const procedureIds: number[] = [];
    for (const benefit of benefits) {
      if (benefit.kind === BenefitKind.quota) {
        if (benefit.quantity == null) {
          throw new BadRequestException(
            `Quota benefit "${benefit.title}" requires quantity`,
          );
        }
        const ids = benefit.procedureIds ?? [];
        if (ids.length === 0) {
          throw new BadRequestException(
            `Quota benefit "${benefit.title}" requires at least one procedure`,
          );
        }
        if (new Set(ids).size !== ids.length) {
          throw new BadRequestException(
            `Quota benefit "${benefit.title}" has duplicate procedures`,
          );
        }
        procedureIds.push(...ids);
      } else if (benefit.discountPercent == null) {
        throw new BadRequestException(
          `Discount benefit "${benefit.title}" requires discountPercent`,
        );
      } else if ((benefit.procedureIds ?? []).length > 0) {
        throw new BadRequestException(
          `Discount benefit "${benefit.title}" cannot list procedures`,
        );
      }
    }

    if (procedureIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(procedureIds)];
    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (procedures.length !== uniqueIds.length) {
      const found = new Set(procedures.map((item) => item.id));
      const missing = uniqueIds.find((id) => !found.has(id));
      throw new NotFoundException(`Procedure ${missing} not found`);
    }
  }
}

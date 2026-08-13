import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthPlanDto } from './dto/create-health-plan.dto';
import { UpdateHealthPlanDto } from './dto/update-health-plan.dto';

@Injectable()
export class HealthPlansService {
  constructor(private readonly prisma: PrismaService) {}

  create(createHealthPlanDto: CreateHealthPlanDto) {
    return this.prisma.healthPlan.create({
      data: {
        name: normalizeName(createHealthPlanDto.name),
        submissionDeadlineDays: createHealthPlanDto.submissionDeadlineDays,
      },
    });
  }

  findAll() {
    return this.prisma.healthPlan.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const healthPlan = await this.prisma.healthPlan.findUnique({
      where: { id },
    });

    if (!healthPlan) {
      throw new NotFoundException(`Health plan ${id} not found`);
    }

    return healthPlan;
  }

  async update(id: number, updateHealthPlanDto: UpdateHealthPlanDto) {
    await this.findOne(id);

    return this.prisma.healthPlan.update({
      where: { id },
      data: {
        ...(updateHealthPlanDto.name !== undefined && {
          name: normalizeName(updateHealthPlanDto.name),
        }),
        ...(updateHealthPlanDto.submissionDeadlineDays !== undefined && {
          submissionDeadlineDays: updateHealthPlanDto.submissionDeadlineDays,
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.healthPlan.delete({ where: { id } });
  }
}

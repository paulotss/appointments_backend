import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeName } from '../common/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedurePackageDto } from './dto/create-procedure-package.dto';
import { ListProcedurePackagesQueryDto } from './dto/list-procedure-packages-query.dto';
import { ProcedurePackageItemInputDto } from './dto/procedure-package-item-input.dto';
import { UpdateProcedurePackageDto } from './dto/update-procedure-package.dto';

const procedurePackageInclude = {
  items: {
    include: { procedure: true },
    orderBy: { id: 'asc' as const },
  },
} as const;

@Injectable()
export class ProcedurePackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProcedurePackageDto) {
    await this.ensureItemsValid(dto.items);

    return this.prisma.procedurePackage.create({
      data: {
        name: normalizeName(dto.name),
        discountPercent: dto.discountPercent,
        isActive: dto.isActive ?? true,
        items: {
          create: dto.items.map((item) => ({
            procedureId: item.procedureId,
            quantity: item.quantity,
          })),
        },
      },
      include: procedurePackageInclude,
    });
  }

  findAll(query: ListProcedurePackagesQueryDto) {
    return this.prisma.procedurePackage.findMany({
      where: {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
      },
      orderBy: { id: 'asc' },
      include: procedurePackageInclude,
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.procedurePackage.findUnique({
      where: { id },
      include: procedurePackageInclude,
    });

    if (!item) {
      throw new NotFoundException(`Procedure package ${id} not found`);
    }

    return item;
  }

  async update(id: number, dto: UpdateProcedurePackageDto) {
    await this.findOne(id);

    if (dto.items !== undefined) {
      await this.ensureItemsValid(dto.items);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items !== undefined) {
        await tx.procedurePackageItem.deleteMany({
          where: { packageId: id },
        });
      }

      return tx.procedurePackage.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: normalizeName(dto.name) }),
          ...(dto.discountPercent !== undefined && {
            discountPercent: dto.discountPercent,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.items !== undefined && {
            items: {
              create: dto.items.map((item) => ({
                procedureId: item.procedureId,
                quantity: item.quantity,
              })),
            },
          }),
        },
        include: procedurePackageInclude,
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      return await this.prisma.procedurePackage.delete({
        where: { id },
        include: procedurePackageInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Procedure package cannot be removed because it is assigned to a patient',
        );
      }
      throw error;
    }
  }

  private async ensureItemsValid(items: ProcedurePackageItemInputDto[]) {
    const procedureIds = items.map((item) => item.procedureId);
    const uniqueIds = new Set(procedureIds);
    if (uniqueIds.size !== procedureIds.length) {
      throw new BadRequestException(
        'items cannot contain duplicate procedureId',
      );
    }

    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true },
    });

    if (procedures.length !== uniqueIds.size) {
      const found = new Set(procedures.map((item) => item.id));
      const missing = procedureIds.find((id) => !found.has(id));
      throw new NotFoundException(`Procedure ${missing} not found`);
    }
  }
}

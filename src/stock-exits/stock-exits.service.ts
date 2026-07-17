import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { stockBatchQuantityUpdate } from '../stock-batches/stock-batch-auto-close';
import {
  StockUnitDto,
  toBaseUnits,
} from '../stock/stock-unit-conversion';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockExitDto } from './dto/create-stock-exit.dto';
import { UpdateStockExitDto } from './dto/update-stock-exit.dto';

const stockExitInclude = {
  batch: {
    include: {
      product: true,
    },
  },
  user: {
    omit: { passwordHash: true },
  },
  healthProfessional: {
    include: {
      specialty: true,
    },
  },
} satisfies Prisma.StockExitInclude;

@Injectable()
export class StockExitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createStockExitDto: CreateStockExitDto) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.stockBatch.findUnique({
        where: { id: createStockExitDto.batchId },
        include: { product: true },
      });

      if (!batch) {
        throw new NotFoundException(
          `Stock batch ${createStockExitDto.batchId} not found`,
        );
      }

      if (createStockExitDto.healthProfessionalId !== undefined) {
        await this.ensureActiveHealthProfessional(
          tx,
          createStockExitDto.healthProfessionalId,
        );
      }

      const unit = createStockExitDto.unit ?? StockUnitDto.UNIT;
      let quantityInBaseUnits: number;

      try {
        quantityInBaseUnits = toBaseUnits(
          createStockExitDto.quantity,
          unit,
          batch.product.unitsPerPackage,
        );
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid stock unit',
        );
      }

      if (quantityInBaseUnits > batch.currentQuantity) {
        throw new BadRequestException('Insufficient stock in batch');
      }

      const exit = await tx.stockExit.create({
        data: {
          batchId: createStockExitDto.batchId,
          quantity: quantityInBaseUnits,
          userId: createStockExitDto.userId,
          exitDate: new Date(createStockExitDto.exitDate),
          healthProfessionalId: createStockExitDto.healthProfessionalId,
        },
        include: stockExitInclude,
      });

      await tx.stockBatch.update({
        where: { id: createStockExitDto.batchId },
        data: stockBatchQuantityUpdate(
          batch.currentQuantity - quantityInBaseUnits,
        ),
      });

      return exit;
    });
  }

  findAll() {
    return this.prisma.stockExit.findMany({
      orderBy: { id: 'asc' },
      include: stockExitInclude,
    });
  }

  async findOne(id: number) {
    const exit = await this.prisma.stockExit.findUnique({
      where: { id },
      include: stockExitInclude,
    });

    if (!exit) {
      throw new NotFoundException(`Stock exit ${id} not found`);
    }

    return exit;
  }

  async update(id: number, updateStockExitDto: UpdateStockExitDto) {
    await this.findOne(id);

    if (
      updateStockExitDto.healthProfessionalId !== undefined &&
      updateStockExitDto.healthProfessionalId !== null
    ) {
      await this.ensureActiveHealthProfessional(
        this.prisma,
        updateStockExitDto.healthProfessionalId,
      );
    }

    return this.prisma.stockExit.update({
      where: { id },
      data: this.mapUpdateDtoToData(updateStockExitDto),
      include: stockExitInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.stockExit.delete({
      where: { id },
      include: stockExitInclude,
    });
  }

  private mapUpdateDtoToData(
    updateStockExitDto: UpdateStockExitDto,
  ): Prisma.StockExitUpdateInput {
    const data: Prisma.StockExitUpdateInput = {};

    if (updateStockExitDto.batchId !== undefined) {
      data.batch = { connect: { id: updateStockExitDto.batchId } };
    }

    if (updateStockExitDto.quantity !== undefined) {
      data.quantity = updateStockExitDto.quantity;
    }

    if (updateStockExitDto.userId !== undefined) {
      data.user = { connect: { id: updateStockExitDto.userId } };
    }

    if (updateStockExitDto.exitDate !== undefined) {
      data.exitDate = new Date(updateStockExitDto.exitDate);
    }

    if (updateStockExitDto.healthProfessionalId !== undefined) {
      data.healthProfessional =
        updateStockExitDto.healthProfessionalId === null
          ? { disconnect: true }
          : { connect: { id: updateStockExitDto.healthProfessionalId } };
    }

    return data;
  }

  private async ensureActiveHealthProfessional(
    client: Prisma.TransactionClient | PrismaService,
    healthProfessionalId: number,
  ) {
    const professional = await client.healthProfessional.findUnique({
      where: { id: healthProfessionalId },
    });

    if (!professional) {
      throw new NotFoundException(
        `Health professional ${healthProfessionalId} not found`,
      );
    }

    if (!professional.isActive) {
      throw new BadRequestException(
        `Health professional ${healthProfessionalId} is inactive`,
      );
    }
  }
}

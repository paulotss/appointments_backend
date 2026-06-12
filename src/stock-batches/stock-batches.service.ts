import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';

const stockBatchInclude = {
  product: true,
  sector: true,
  location: true,
  user: {
    omit: { passwordHash: true },
  },
} satisfies Prisma.StockBatchInclude;

@Injectable()
export class StockBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createStockBatchDto: CreateStockBatchDto) {
    const currentQuantity =
      createStockBatchDto.currentQuantity ?? createStockBatchDto.initialQuantity;

    return this.prisma.stockBatch.create({
      data: {
        productId: createStockBatchDto.productId,
        sectorId: createStockBatchDto.sectorId,
        initialQuantity: createStockBatchDto.initialQuantity,
        currentQuantity,
        value: createStockBatchDto.value,
        movementDate: new Date(createStockBatchDto.movementDate),
        expirationDate: createStockBatchDto.expirationDate
          ? new Date(createStockBatchDto.expirationDate)
          : undefined,
        notes: createStockBatchDto.notes,
        userId: createStockBatchDto.userId,
        invoiceAccessKey: createStockBatchDto.invoiceAccessKey,
        locationId: createStockBatchDto.locationId,
      },
      include: stockBatchInclude,
    });
  }

  findAll() {
    return this.prisma.stockBatch.findMany({
      orderBy: { id: 'asc' },
      include: stockBatchInclude,
    });
  }

  async findOne(id: number) {
    const batch = await this.prisma.stockBatch.findUnique({
      where: { id },
      include: stockBatchInclude,
    });

    if (!batch) {
      throw new NotFoundException(`Stock batch ${id} not found`);
    }

    return batch;
  }

  async update(id: number, updateStockBatchDto: UpdateStockBatchDto) {
    await this.findOne(id);

    return this.prisma.stockBatch.update({
      where: { id },
      data: this.mapUpdateDtoToData(updateStockBatchDto),
      include: stockBatchInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.stockBatch.delete({
      where: { id },
      include: stockBatchInclude,
    });
  }

  private mapUpdateDtoToData(
    updateStockBatchDto: UpdateStockBatchDto,
  ): Prisma.StockBatchUpdateInput {
    const data: Prisma.StockBatchUpdateInput = {};

    if (updateStockBatchDto.productId !== undefined) {
      data.product = { connect: { id: updateStockBatchDto.productId } };
    }

    if (updateStockBatchDto.sectorId !== undefined) {
      data.sector = { connect: { id: updateStockBatchDto.sectorId } };
    }

    if (updateStockBatchDto.locationId !== undefined) {
      data.location = { connect: { id: updateStockBatchDto.locationId } };
    }

    if (updateStockBatchDto.userId !== undefined) {
      data.user = { connect: { id: updateStockBatchDto.userId } };
    }

    if (updateStockBatchDto.initialQuantity !== undefined) {
      data.initialQuantity = updateStockBatchDto.initialQuantity;
    }

    if (updateStockBatchDto.currentQuantity !== undefined) {
      data.currentQuantity = updateStockBatchDto.currentQuantity;
    }

    if (updateStockBatchDto.value !== undefined) {
      data.value = updateStockBatchDto.value;
    }

    if (updateStockBatchDto.movementDate !== undefined) {
      data.movementDate = new Date(updateStockBatchDto.movementDate);
    }

    if (updateStockBatchDto.expirationDate !== undefined) {
      data.expirationDate = new Date(updateStockBatchDto.expirationDate);
    }

    if (updateStockBatchDto.notes !== undefined) {
      data.notes = updateStockBatchDto.notes;
    }

    if (updateStockBatchDto.invoiceAccessKey !== undefined) {
      data.invoiceAccessKey = updateStockBatchDto.invoiceAccessKey;
    }

    return data;
  }
}

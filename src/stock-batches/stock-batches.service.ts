import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  StockUnitDto,
  toBaseUnits,
  toUnitCost,
  ValueMode,
} from '../stock/stock-unit-conversion';
import { stockBatchQuantityUpdate } from './stock-batch-auto-close';
import { stockBatchInclude } from './stock-batch.include';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { StockBatchListStatus } from './stock-batch-list-status.enum';

@Injectable()
export class StockBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createStockBatchDto: CreateStockBatchDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: createStockBatchDto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Product ${createStockBatchDto.productId} not found`,
      );
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: createStockBatchDto.supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier ${createStockBatchDto.supplierId} not found`,
      );
    }

    const unit = createStockBatchDto.unit ?? StockUnitDto.UNIT;
    const valueMode =
      createStockBatchDto.valueMode ?? ValueMode.PER_ENTRY_UNIT;

    const initialQuantity = this.convertQuantity(
      createStockBatchDto.initialQuantity,
      unit,
      product.unitsPerPackage,
    );
    const currentQuantity = this.convertQuantity(
      createStockBatchDto.currentQuantity ?? createStockBatchDto.initialQuantity,
      unit,
      product.unitsPerPackage,
    );
    const unitCost =
      createStockBatchDto.value !== undefined
        ? this.convertUnitCost(
            createStockBatchDto.value,
            valueMode,
            unit,
            product.unitsPerPackage,
          )
        : undefined;

    return this.prisma.stockBatch.create({
      data: {
        productId: createStockBatchDto.productId,
        sectorId: createStockBatchDto.sectorId,
        supplierId: createStockBatchDto.supplierId,
        initialQuantity,
        ...stockBatchQuantityUpdate(currentQuantity),
        unitCost,
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

  findAll(status: StockBatchListStatus = StockBatchListStatus.Open) {
    const where =
      status === StockBatchListStatus.All
        ? undefined
        : { isClosed: status === StockBatchListStatus.Closed };

    return this.prisma.stockBatch.findMany({
      where,
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

  async close(id: number) {
    await this.findOne(id);

    return this.prisma.stockBatch.update({
      where: { id },
      data: { isClosed: true },
      include: stockBatchInclude,
    });
  }

  async update(id: number, updateStockBatchDto: UpdateStockBatchDto) {
    const existing = await this.findOne(id);
    const productId =
      updateStockBatchDto.productId ?? existing.productId;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    return this.prisma.stockBatch.update({
      where: { id },
      data: this.mapUpdateDtoToData(
        updateStockBatchDto,
        product.unitsPerPackage,
      ),
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
    unitsPerPackage: number,
  ): Prisma.StockBatchUpdateInput {
    const data: Prisma.StockBatchUpdateInput = {};
    const unit = updateStockBatchDto.unit ?? StockUnitDto.UNIT;
    const valueMode =
      updateStockBatchDto.valueMode ?? ValueMode.PER_ENTRY_UNIT;

    if (updateStockBatchDto.productId !== undefined) {
      data.product = { connect: { id: updateStockBatchDto.productId } };
    }

    if (updateStockBatchDto.sectorId !== undefined) {
      data.sector = { connect: { id: updateStockBatchDto.sectorId } };
    }

    if (updateStockBatchDto.supplierId !== undefined) {
      data.supplier = { connect: { id: updateStockBatchDto.supplierId } };
    }

    if (updateStockBatchDto.locationId !== undefined) {
      data.location = { connect: { id: updateStockBatchDto.locationId } };
    }

    if (updateStockBatchDto.userId !== undefined) {
      data.user = { connect: { id: updateStockBatchDto.userId } };
    }

    if (updateStockBatchDto.initialQuantity !== undefined) {
      data.initialQuantity = this.convertQuantity(
        updateStockBatchDto.initialQuantity,
        unit,
        unitsPerPackage,
      );
    }

    if (updateStockBatchDto.currentQuantity !== undefined) {
      Object.assign(
        data,
        stockBatchQuantityUpdate(
          this.convertQuantity(
            updateStockBatchDto.currentQuantity,
            unit,
            unitsPerPackage,
          ),
        ),
      );
    }

    if (updateStockBatchDto.unitCost !== undefined) {
      data.unitCost = updateStockBatchDto.unitCost;
    } else if (updateStockBatchDto.value !== undefined) {
      data.unitCost = this.convertUnitCost(
        updateStockBatchDto.value,
        valueMode,
        unit,
        unitsPerPackage,
      );
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

  private convertQuantity(
    quantity: number,
    unit: StockUnitDto,
    unitsPerPackage: number,
  ): number {
    try {
      return toBaseUnits(quantity, unit, unitsPerPackage);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid stock unit',
      );
    }
  }

  private convertUnitCost(
    value: number,
    valueMode: ValueMode,
    unit: StockUnitDto,
    unitsPerPackage: number,
  ): number {
    try {
      return toUnitCost(value, valueMode, unit, unitsPerPackage);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid stock unit',
      );
    }
  }
}

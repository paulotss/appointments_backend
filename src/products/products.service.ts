import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { stockBatchInclude } from '../stock-batches/stock-batch.include';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductWithBatches = Prisma.ProductGetPayload<{
  include: {
    stockBatches: { include: typeof stockBatchInclude };
  };
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductDto,
      include: { category: true },
    });
  }

  findAll(includeInactive = false) {
    return this.prisma.product.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { id: 'asc' },
      include: { category: true },
    });
  }

  async findOne(id: number, includeInactive = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product || (!includeInactive && !product.isActive)) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async findStockConsolidation(includeInactive = false) {
    const products = await this.prisma.product.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { id: 'asc' },
      include: {
        stockBatches: {
          where: { isClosed: false },
          include: stockBatchInclude,
          orderBy: [{ movementDate: 'desc' }, { id: 'desc' }],
        },
      },
    });

    return products.map((product) => this.mapProductToStockConsolidation(product));
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    await this.findOne(id, true);

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
      include: { category: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id, true);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: { category: true },
    });
  }

  private mapProductToStockConsolidation(product: ProductWithBatches) {
    const { batchesWithStock, totalQuantity, averagePrice, expiringBatchesCount, expiredBatchesCount } =
      this.aggregateStockBatches(product.stockBatches);

    return {
      name: product.name,
      sku: product.sku,
      totalQuantity,
      averagePrice,
      expiringBatchesCount,
      expiredBatchesCount,
      minimumStock: product.minimumStock,
      stockBatches: batchesWithStock,
    };
  }

  private aggregateStockBatches(
    batches: ProductWithBatches['stockBatches'],
  ) {
    const today = this.startOfDay(new Date());
    const in30Days = this.addDays(today, 30);

    const batchesWithStock = batches.filter(
      (batch) => !batch.isClosed && batch.currentQuantity > 0,
    );

    const totalQuantity = batches.reduce(
      (sum, batch) => sum + batch.currentQuantity,
      0,
    );

    const recentWithValue = batches
      .filter((batch) => batch.value != null)
      .slice(0, 3);

    const averagePrice = recentWithValue.length
      ? recentWithValue.reduce((sum, batch) => sum + Number(batch.value), 0) /
        recentWithValue.length
      : null;

    let expiringBatchesCount = 0;
    let expiredBatchesCount = 0;

    for (const batch of batchesWithStock) {
      if (!batch.expirationDate) {
        continue;
      }

      const expirationDate = this.startOfDay(batch.expirationDate);

      if (expirationDate < today) {
        expiredBatchesCount++;
      } else if (expirationDate <= in30Days) {
        expiringBatchesCount++;
      }
    }

    return {
      batchesWithStock,
      totalQuantity,
      averagePrice,
      expiringBatchesCount,
      expiredBatchesCount,
    };
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

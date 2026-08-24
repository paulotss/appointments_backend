import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  endOfDaySaoPaulo,
  startOfDaySaoPaulo,
} from '../common/datetime/sao-paulo-day-bounds';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { ListFinancialExitsQueryDto } from './dto/list-financial-exits-query.dto';

const financialExitInclude = {
  payable: { include: { supplier: true } },
} as const;

@Injectable()
export class FinancialExitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListFinancialExitsQueryDto,
  ): Promise<
    ListEnvelope<
      Prisma.FinancialExitGetPayload<{ include: typeof financialExitInclude }>
    >
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const paidAt =
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

    const where: Prisma.FinancialExitWhereInput = {
      ...(query.paymentMethod !== undefined && {
        paymentMethod: query.paymentMethod,
      }),
      ...(paidAt !== undefined && { paidAt }),
      ...(query.supplierId !== undefined && {
        payable: { supplierId: query.supplierId },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.financialExit.findMany({
        where,
        include: financialExitInclude,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financialExit.count({ where }),
    ]);

    return { data, meta: buildListMeta(page, limit, total) };
  }

  async findOne(id: number) {
    const exit = await this.prisma.financialExit.findUnique({
      where: { id },
      include: financialExitInclude,
    });
    if (!exit) {
      throw new NotFoundException(`Financial exit ${id} not found`);
    }
    return exit;
  }
}

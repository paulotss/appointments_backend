import { Prisma } from '@prisma/client';

export const stockBatchInclude = {
  product: true,
  sector: true,
  location: true,
  supplier: true,
  user: {
    omit: { passwordHash: true },
  },
} satisfies Prisma.StockBatchInclude;

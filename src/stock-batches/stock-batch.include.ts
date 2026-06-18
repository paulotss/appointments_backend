import { Prisma } from '@prisma/client';

export const stockBatchInclude = {
  product: true,
  sector: true,
  location: true,
  user: {
    omit: { passwordHash: true },
  },
} satisfies Prisma.StockBatchInclude;

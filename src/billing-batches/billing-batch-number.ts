import { randomUUID } from 'crypto';

export function buildBatchNumber(id: number, createdAt: Date): string {
  const yyyymmdd = createdAt.toISOString().slice(0, 10).replaceAll('-', '');
  return `${id}-${yyyymmdd}`;
}

export function pendingBatchNumber(): string {
  return randomUUID();
}

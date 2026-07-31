import { CallRecordStatus } from '@prisma/client';

export type ListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type RecordStatusCounts = {
  pending: number;
  registered: number;
  cancelled: number;
  total: number;
};

export type ListEnvelope<T> = {
  data: T[];
  meta: ListMeta;
  counts: RecordStatusCounts;
};

export function buildListMeta(
  page: number,
  limit: number,
  total: number,
): ListMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export function mapRecordStatusCounts(
  groups: Array<{ recordStatus: CallRecordStatus; _count: { _all: number } }>,
): RecordStatusCounts {
  const byStatus: Record<CallRecordStatus, number> = {
    [CallRecordStatus.pending]: 0,
    [CallRecordStatus.registered]: 0,
    [CallRecordStatus.cancelled]: 0,
  };

  for (const group of groups) {
    byStatus[group.recordStatus] = group._count._all;
  }

  const pending = byStatus[CallRecordStatus.pending];
  const registered = byStatus[CallRecordStatus.registered];
  const cancelled = byStatus[CallRecordStatus.cancelled];

  return {
    pending,
    registered,
    cancelled,
    total: pending + registered + cancelled,
  };
}

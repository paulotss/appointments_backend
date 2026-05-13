import type { CallRecordStatus } from '@prisma/client';

export class UpdateCallDto {
  recordStatus?: CallRecordStatus;
  note?: string | null;
}

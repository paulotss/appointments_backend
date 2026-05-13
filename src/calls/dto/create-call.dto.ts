import type { CallRecordStatus } from '@prisma/client';

export class CreateCallDto {
  receivedAt?: string;
  origin!: string;
  extension!: number;
  status!: string;
  recordStatus?: CallRecordStatus;
  note?: string | null;
}

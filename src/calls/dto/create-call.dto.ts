import { CallRecordStatus, CallStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCallDto {
  @ApiPropertyOptional({ example: '2026-05-13T09:15:00.000Z' })
  receivedAt?: string;

  @ApiProperty({ example: '+551140028922' })
  origin!: string;

  @ApiProperty({ example: 'Ramal 2010' })
  destination!: string;

  @ApiProperty({ example: 2010 })
  extension!: number;

  @ApiProperty({ enum: CallStatus, example: CallStatus.ATENDIDO })
  status!: CallStatus;

  @ApiPropertyOptional({
    enum: CallRecordStatus,
    example: CallRecordStatus.pending,
  })
  recordStatus?: CallRecordStatus;

  @ApiPropertyOptional({
    example: 'Ligação transferida para ramal 2010',
    nullable: true,
  })
  note?: string | null;
}

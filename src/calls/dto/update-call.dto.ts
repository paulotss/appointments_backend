import { CallRecordStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCallDto {
  @ApiPropertyOptional({
    enum: CallRecordStatus,
    example: CallRecordStatus.registered,
  })
  recordStatus?: CallRecordStatus;

  @ApiPropertyOptional({
    example: 'Registrado no sistema de agendamentos',
    nullable: true,
  })
  note?: string | null;
}

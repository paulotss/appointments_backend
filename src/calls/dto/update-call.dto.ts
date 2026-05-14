import { CallRecordStatus, CallStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCallDto {
  @ApiPropertyOptional({ enum: CallStatus, example: CallStatus.REALIZADO })
  status?: CallStatus;

  @ApiPropertyOptional({ example: 'Ramal 2020' })
  destination?: string;

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

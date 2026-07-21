import { CallRecordStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMessageDto {
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

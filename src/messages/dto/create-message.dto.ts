import { CallRecordStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: '3F6667577A5171AA6CB6768ED2CE4BFB' })
  interactionId!: string;

  @ApiProperty({ example: '556192896035' })
  recipient!: string;

  @ApiProperty({ example: '2026-07-20T19:57:47.246+00:00' })
  finishAt!: string;

  @ApiPropertyOptional({ example: 'elis_lima14@yahoo.com.br', nullable: true })
  humanEmail?: string | null;

  @ApiPropertyOptional({
    enum: CallRecordStatus,
    example: CallRecordStatus.pending,
  })
  recordStatus?: CallRecordStatus;

  @ApiPropertyOptional({
    example: 'Conversa finalizada no GPT Maker',
    nullable: true,
  })
  note?: string | null;
}

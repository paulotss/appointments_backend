import { ContactMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    example: '2026-05-15T14:30:00.000Z',
    description: 'Data/hora do agendamento (ISO 8601)',
  })
  date!: string;

  @ApiProperty({ example: 'João Pereira' })
  clientName!: string;

  @ApiPropertyOptional({ example: '+5511999998888' })
  phone?: string;

  @ApiProperty({ enum: ContactMethod, example: ContactMethod.whatsapp })
  contactMethod!: ContactMethod;

  @ApiProperty({ example: true })
  firstTime!: boolean;

  @ApiProperty({ example: false })
  scheduled!: boolean;

  @ApiPropertyOptional({ example: 'Consulta de rotina' })
  reason?: string;

  @ApiPropertyOptional({ example: 1, nullable: true })
  specialtyId?: number | null;

  @ApiPropertyOptional({ example: 'Cliente prefere manhã' })
  notes?: string;

  @ApiPropertyOptional({ example: 2, nullable: true })
  attendantId?: number | null;
}

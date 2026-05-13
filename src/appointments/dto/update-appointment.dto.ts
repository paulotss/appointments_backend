import { ContactMethod } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ example: '2026-05-16T10:00:00.000Z' })
  date?: string;

  @ApiPropertyOptional({ example: 'João Pereira Santos' })
  clientName?: string;

  @ApiPropertyOptional({ example: '+5511988887777' })
  phone?: string;

  @ApiPropertyOptional({ enum: ContactMethod, example: ContactMethod.phone })
  contactMethod?: ContactMethod;

  @ApiPropertyOptional({ example: false })
  firstTime?: boolean;

  @ApiPropertyOptional({ example: true })
  scheduled?: boolean;

  @ApiPropertyOptional({ example: 'Retorno' })
  reason?: string;

  @ApiPropertyOptional({ example: 2, nullable: true })
  specialtyId?: number | null;

  @ApiPropertyOptional({ example: 'Confirmado por WhatsApp' })
  notes?: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  attendantId?: number | null;
}

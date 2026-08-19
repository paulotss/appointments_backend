import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateClinicalAppointmentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId!: number;

  @ApiProperty({
    example: '2026-08-20T14:30:00.000Z',
    description: 'Data/hora do agendamento (ISO 8601)',
  })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({
    enum: ClinicalAppointmentType,
    example: ClinicalAppointmentType.private,
    description: 'private (particular) ou health_plan (plano de saude)',
  })
  @IsEnum(ClinicalAppointmentType)
  type!: ClinicalAppointmentType;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentStatus,
    example: ClinicalAppointmentStatus.marked,
    default: ClinicalAppointmentStatus.marked,
    description:
      'marked (marcado), confirmed (confirmado), waiting (em espera), attended (atendido), finished (finalizado)',
  })
  @IsOptional()
  @IsEnum(ClinicalAppointmentStatus)
  status?: ClinicalAppointmentStatus;

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 11],
    description:
      'Obrigatorio quando type = health_plan (minimo 1). Nao enviar no particular.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  insuranceGuideIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description:
      'Obrigatorio quando type = private. Nao enviar no plano de saude.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  procedureIds?: number[];
}

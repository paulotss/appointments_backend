import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateClinicalAppointmentDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId?: number;

  @ApiPropertyOptional({
    example: '2026-08-20T14:30:00.000Z',
    description: 'Data/hora de inicio do agendamento (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    example: '2026-08-20T15:00:00.000Z',
    description: 'Data/hora de termino do agendamento (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentType,
    example: ClinicalAppointmentType.health_plan,
  })
  @IsOptional()
  @IsEnum(ClinicalAppointmentType)
  type?: ClinicalAppointmentType;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentStatus,
    example: ClinicalAppointmentStatus.finished,
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
      'Usado quando type = private. Ignorado/proibido no plano de saude.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  procedureIds?: number[];
}

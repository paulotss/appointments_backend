import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class ListClinicalAppointmentsQueryDto {
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

  @ApiPropertyOptional({ enum: ClinicalAppointmentStatus })
  @IsOptional()
  @IsEnum(ClinicalAppointmentStatus)
  status?: ClinicalAppointmentStatus;

  @ApiPropertyOptional({ enum: ClinicalAppointmentType })
  @IsOptional()
  @IsEnum(ClinicalAppointmentType)
  type?: ClinicalAppointmentType;

  @ApiPropertyOptional({
    example: 10,
    description: 'Filtrar por guia de plano de saude',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  insuranceGuideId?: number;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Data inicial inclusiva (YYYY-MM-DD, America/Sao_Paulo)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'Data final inclusiva (YYYY-MM-DD, America/Sao_Paulo)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalAppointmentId({
  value,
  obj,
}: {
  value: unknown;
  obj: Record<string, unknown>;
}) {
  if (!Object.prototype.hasOwnProperty.call(obj, 'clinicalAppointmentId')) {
    return undefined;
  }
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}

export class UpdateClinicalEvolutionDto {
  @ApiPropertyOptional({ example: '2026-10-03T14:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Transform(optionalAppointmentId)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  clinicalAppointmentId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  subjective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  assessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  plan?: string;
}

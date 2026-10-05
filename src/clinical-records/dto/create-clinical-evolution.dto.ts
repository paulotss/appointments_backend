import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

function optionalAppointmentId({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}

export class CreateClinicalEvolutionDto {
  @ApiProperty({ example: '2026-10-03T14:30:00.000Z' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(optionalAppointmentId)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  clinicalAppointmentId?: number | null;

  @ApiProperty({ example: 'Dor de cabeça há 2 dias' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  subjective!: string;

  @ApiProperty({ example: 'PA 120x80, afebril' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  objective!: string;

  @ApiProperty({ example: 'Cefaleia tensional' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  assessment!: string;

  @ApiProperty({ example: 'Analgésico e retorno em 7 dias' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  plan!: string;
}

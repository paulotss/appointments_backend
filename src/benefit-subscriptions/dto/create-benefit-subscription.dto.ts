import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateBenefitSubscriptionDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiProperty({
    example: '2026-10-01',
    description: 'Início da vigência (YYYY-MM-DD)',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: 10, description: 'Dia de vencimento de 1 a 31' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay!: number;

  @ApiProperty({ example: 12, description: 'Número de parcelas da anuidade' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  installmentCount!: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [2, 3],
    description: 'Pacientes dependentes. Não altera parcelas depois da adesão.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  dependentPatientIds?: number[];
}

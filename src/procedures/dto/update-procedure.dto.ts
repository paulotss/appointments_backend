import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { HealthPlanPriceInputDto } from './health-plan-price-input.dto';

export class UpdateProcedureDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;

  @ApiPropertyOptional({ example: 'Consulta' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    example: 150.0,
    description: 'Preco padrao particular',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  @ApiPropertyOptional({
    type: [HealthPlanPriceInputDto],
    example: [{ healthPlanId: 1, tissCode: '10101012', value: 80 }],
    description: 'Substitui todos os precos por plano. Envie [] para remover.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthPlanPriceInputDto)
  healthPlanPrices?: HealthPlanPriceInputDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateProcedureDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId!: number;

  @ApiProperty({ example: '10101012', description: 'Codigo TISS/TUSS' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  tissCode!: string;

  @ApiProperty({ example: 'Consulta' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 150.0,
    description: 'Preco padrao particular',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;

  @ApiPropertyOptional({
    type: [HealthPlanPriceInputDto],
    example: [{ healthPlanId: 1, value: 80 }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthPlanPriceInputDto)
  healthPlanPrices?: HealthPlanPriceInputDto[];
}

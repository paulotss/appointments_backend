import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TissGuideType } from '@prisma/client';
import { HealthPlanPriceInputDto } from './health-plan-price-input.dto';

export class CreateProcedureDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId!: number;

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

  @ApiProperty({
    enum: TissGuideType,
    example: TissGuideType.consulta,
    description: 'Tipo da guia TISS gerada para este procedimento',
  })
  @IsEnum(TissGuideType)
  tissGuideType!: TissGuideType;

  @ApiPropertyOptional({
    type: [HealthPlanPriceInputDto],
    example: [{ healthPlanId: 1, tissCode: '10101012', value: 80 }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthPlanPriceInputDto)
  healthPlanPrices?: HealthPlanPriceInputDto[];
}

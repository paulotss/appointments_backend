import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class HealthPlanPriceInputDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId!: number;

  @ApiProperty({
    example: '10101012',
    description: 'Codigo TISS/TUSS deste procedimento neste plano',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  tissCode!: string;

  @ApiProperty({
    example: 80.0,
    description: 'Preco do procedimento neste plano de saude',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;
}

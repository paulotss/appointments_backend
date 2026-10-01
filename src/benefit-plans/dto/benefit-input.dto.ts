import { BenefitKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class BenefitInputDto {
  @ApiProperty({ example: 'Consulta em especialidades' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: 'Psicologia, nutrição ou acupuntura' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: BenefitKind, example: BenefitKind.quota })
  @IsEnum(BenefitKind)
  kind!: BenefitKind;

  @ApiPropertyOptional({
    example: 1,
    description: 'Obrigatório quando kind é quota.',
  })
  @ValidateIf((item: BenefitInputDto) => item.kind === BenefitKind.quota)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Obrigatório quando kind é discount.',
  })
  @ValidateIf((item: BenefitInputDto) => item.kind === BenefitKind.discount)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: 'Procedimentos cobertos. Obrigatório para cota.',
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  procedureIds?: number[];
}

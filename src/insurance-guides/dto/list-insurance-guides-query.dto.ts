import { InsuranceGuideStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

export class ListInsuranceGuidesQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description:
      'Filtrar guias faturadas (true) ou nao faturadas (false). Se omitido, lista todas',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isBilled?: boolean;

  @ApiPropertyOptional({
    enum: InsuranceGuideStatus,
    example: InsuranceGuideStatus.pending,
  })
  @IsOptional()
  @IsEnum(InsuranceGuideStatus)
  status?: InsuranceGuideStatus;

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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId?: number;

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description:
      'Se true, lista apenas guias elegiveis para lote: isBilled=false, fora de lote e com usedQuantity > 0',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  availableForBilling?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

import { InsuranceGuideStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

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
}

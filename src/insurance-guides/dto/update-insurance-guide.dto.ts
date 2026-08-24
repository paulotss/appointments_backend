import { InsuranceGuideStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { InsuranceGuideProcedureInputDto } from './insurance-guide-procedure-input.dto';

export class UpdateInsuranceGuideDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId?: number;

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

  @ApiPropertyOptional({
    type: [InsuranceGuideProcedureInputDto],
    example: [{ procedureId: 1, authorizedQuantity: 10, value: 80 }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InsuranceGuideProcedureInputDto)
  procedures?: InsuranceGuideProcedureInputDto[];

  @ApiPropertyOptional({
    example: '2026-09-12',
    description: 'Data de validade da guia (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({
    enum: InsuranceGuideStatus,
    example: InsuranceGuideStatus.authorized,
    description:
      'pending (pendente), under_analysis (em analise), authorized (autorizada)',
  })
  @IsOptional()
  @IsEnum(InsuranceGuideStatus)
  status?: InsuranceGuideStatus;
}

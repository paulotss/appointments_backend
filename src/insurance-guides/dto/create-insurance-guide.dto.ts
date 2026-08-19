import { InsuranceGuideStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { InsuranceGuideProcedureInputDto } from './insurance-guide-procedure-input.dto';

export class CreateInsuranceGuideDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId!: number;

  @ApiProperty({
    type: [InsuranceGuideProcedureInputDto],
    example: [{ procedureId: 1, authorizedQuantity: 10 }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InsuranceGuideProcedureInputDto)
  procedures!: InsuranceGuideProcedureInputDto[];

  @ApiPropertyOptional({
    example: '2026-09-12',
    description:
      'Data de validade da guia (YYYY-MM-DD). Se omitida, usa hoje + submissionDeadlineDays do plano',
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    default: false,
    description: 'Indica se a guia ja foi faturada. Padrao false',
  })
  @IsOptional()
  @IsBoolean()
  isBilled?: boolean;

  @ApiPropertyOptional({
    enum: InsuranceGuideStatus,
    example: InsuranceGuideStatus.pending,
    default: InsuranceGuideStatus.pending,
    description:
      'pending (pendente), under_analysis (em analise), authorized (autorizada)',
  })
  @IsOptional()
  @IsEnum(InsuranceGuideStatus)
  status?: InsuranceGuideStatus;
}

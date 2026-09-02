import { InsuranceGuideStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CommitGuideImportProcedureDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  procedureId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorizedQuantity!: number;
}

export class CommitGuideImportPatientDto {
  @ApiProperty({ enum: ['existing', 'create'] })
  @IsIn(['existing', 'create'])
  mode!: 'existing' | 'create';

  @ApiPropertyOptional({ example: 1 })
  @ValidateIf((value: CommitGuideImportPatientDto) => value.mode === 'existing')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @ValidateIf((value: CommitGuideImportPatientDto) => value.mode === 'create')
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: '61999998888' })
  @ValidateIf((value: CommitGuideImportPatientDto) => value.mode === 'create')
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional({ example: '0300021048000055' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  cardNumber?: string;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @IsDateString()
  cardExpirationDate?: string;
}

export class CommitGuideImportDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId!: number;

  @ApiProperty({ type: [CommitGuideImportProcedureDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommitGuideImportProcedureDto)
  procedures!: CommitGuideImportProcedureDto[];

  @ApiProperty({ type: CommitGuideImportPatientDto })
  @ValidateNested()
  @Type(() => CommitGuideImportPatientDto)
  patient!: CommitGuideImportPatientDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  guideNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  authorizationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ enum: InsuranceGuideStatus })
  @IsOptional()
  @IsEnum(InsuranceGuideStatus)
  status?: InsuranceGuideStatus;
}

import { InsuranceGuideStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

  @ApiPropertyOptional({
    example: 1,
    description:
      'Quantidade ja utilizada, sem agendamento. Somente admin. Se omitida, permanece 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usedQuantity?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['2026-09-01', '2026-09-08'],
    description:
      'Datas das sessoes realizadas (YYYY-MM-DD). Admin e colaborador.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(366)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  sessionDates?: string[];
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

  @ApiPropertyOptional({
    example: 'ABC123',
    description: 'Senha de autorizacao da guia (ate 20 caracteres).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  authorizationPassword?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ enum: InsuranceGuideStatus })
  @IsOptional()
  @IsEnum(InsuranceGuideStatus)
  status?: InsuranceGuideStatus;
}

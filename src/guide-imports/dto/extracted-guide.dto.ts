import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExtractedHealthPlanDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  registroAns?: string | null;
}

export class ExtractedPatientDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  cardNumber?: string | null;

  @IsOptional()
  @IsString()
  cardExpirationDate?: string | null;
}

export class ExtractedProfessionalDto {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  councilType?: string | null;

  @IsOptional()
  @IsString()
  councilNumber?: string | null;

  @IsOptional()
  @IsString()
  councilUf?: string | null;

  @IsOptional()
  @IsString()
  cbosCode?: string | null;

  @IsOptional()
  @IsString()
  source?: string | null;
}

export class ExtractedProcedureDto {
  @IsOptional()
  @IsString()
  tissCode?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedQuantity?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorizedQuantity?: number | null;
}

export class ExtractedGuideMetaDto {
  @IsOptional()
  @IsString()
  operatorGuideNumber?: string | null;

  @IsOptional()
  @IsString()
  providerGuideNumber?: string | null;

  @IsOptional()
  @IsString()
  authorizationDate?: string | null;

  @IsOptional()
  @IsString()
  passwordExpirationDate?: string | null;

  @IsOptional()
  @IsString()
  attendanceDate?: string | null;
}

export class ExtractedGuideDto {
  @IsOptional()
  @IsString()
  tissGuideType?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedHealthPlanDto)
  healthPlan?: ExtractedHealthPlanDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedPatientDto)
  patient?: ExtractedPatientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedProfessionalDto)
  professional?: ExtractedProfessionalDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedProcedureDto)
  procedures?: ExtractedProcedureDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ExtractedGuideMetaDto)
  guide?: ExtractedGuideMetaDto;
}

export class MatchGuideImportDto {
  @ValidateNested()
  @Type(() => ExtractedGuideDto)
  extracted!: ExtractedGuideDto;
}

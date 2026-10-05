import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertClinicalChartDto {
  @ApiPropertyOptional({ example: 'Dipirona' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  allergies?: string;

  @ApiPropertyOptional({ example: 'Hipertensão' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  chronicConditions?: string;

  @ApiPropertyOptional({ example: 'Losartana 50 mg' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  currentMedications?: string;

  @ApiPropertyOptional({ example: 'Cirurgia de apendicite em 2010' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  personalHistory?: string;

  @ApiPropertyOptional({ example: 'Pai com diabetes' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  familyHistory?: string;

  @ApiPropertyOptional({ example: 'Não fuma' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  habits?: string;
}

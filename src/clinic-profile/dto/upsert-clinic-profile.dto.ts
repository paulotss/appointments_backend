import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpsertClinicProfileDto {
  @ApiPropertyOptional({ example: 'Clinica Exemplo Ltda' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  legalName?: string | null;

  @ApiPropertyOptional({ example: '12345678000199' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj must have 14 digits' })
  cnpj?: string | null;

  @ApiPropertyOptional({ example: '1234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'cnes must have 7 digits' })
  cnes?: string | null;
}

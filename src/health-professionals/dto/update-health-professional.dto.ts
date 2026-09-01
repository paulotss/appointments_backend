import { ApiPropertyOptional } from '@nestjs/swagger';
import { CouncilType } from '@prisma/client';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BRAZILIAN_UFS } from '../../common/brazilian-uf';
import { HealthProfessionalSpecialtyInputDto } from './health-professional-specialty-input.dto';

export class UpdateHealthProfessionalDto {
  @ApiPropertyOptional({ example: 'Dr. Joao Silva' })
  name?: string;

  @ApiPropertyOptional({
    type: [HealthProfessionalSpecialtyInputDto],
    example: [{ specialtyId: 1 }],
  })
  specialties?: HealthProfessionalSpecialtyInputDto[];

  @ApiPropertyOptional({ enum: CouncilType, example: CouncilType.CRM })
  councilType?: CouncilType;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  councilNumber?: string;

  @ApiPropertyOptional({ example: 'SP', enum: BRAZILIAN_UFS, nullable: true })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsIn(BRAZILIAN_UFS)
  councilUf?: string | null;

  @ApiPropertyOptional({
    example: '225142',
    nullable: true,
    description: 'Codigo CBO-S (6 digitos)',
  })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(/^\d{6}$/, { message: 'cbosCode must have 6 digits' })
  cbosCode?: string | null;

  @ApiPropertyOptional({ example: '52998224725' })
  cpf?: string;

  @ApiPropertyOptional({ example: '11999998888', nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'joao.silva@email.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;
}

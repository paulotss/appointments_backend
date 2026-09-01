import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouncilType } from '@prisma/client';
import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BRAZILIAN_UFS } from '../../common/brazilian-uf';
import { HealthProfessionalSpecialtyInputDto } from './health-professional-specialty-input.dto';

export class CreateHealthProfessionalDto {
  @ApiProperty({ example: 'Dr. Joao Silva' })
  name!: string;

  @ApiProperty({
    type: [HealthProfessionalSpecialtyInputDto],
    example: [{ specialtyId: 1 }],
  })
  specialties!: HealthProfessionalSpecialtyInputDto[];

  @ApiProperty({ enum: CouncilType, example: CouncilType.CRM })
  councilType!: CouncilType;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  councilNumber!: string;

  @ApiProperty({ example: 'SP', enum: BRAZILIAN_UFS })
  @IsIn(BRAZILIAN_UFS)
  councilUf!: string;

  @ApiProperty({ example: '225142', description: 'Codigo CBO-S (6 digitos)' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'cbosCode must have 6 digits' })
  cbosCode!: string;

  @ApiProperty({ example: '52998224725', description: 'CPF com 11 digitos' })
  cpf!: string;

  @ApiPropertyOptional({ example: '11999998888' })
  phone?: string;

  @ApiPropertyOptional({ example: 'joao.silva@email.com' })
  email?: string;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

import { CouncilType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { BRAZILIAN_UFS } from '../../common/brazilian-uf';

export class RequesterProfessionalDto {
  @ApiProperty({ example: 'Ana Paula Lara Barcelos' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: CouncilType, example: CouncilType.CRM })
  @IsEnum(CouncilType)
  councilType!: CouncilType;

  @ApiProperty({ example: '16906' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  councilNumber!: string;

  @ApiProperty({ example: 'DF', enum: BRAZILIAN_UFS })
  @IsIn(BRAZILIAN_UFS)
  councilUf!: string;

  @ApiProperty({ example: '225125' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'cbosCode must have 6 digits' })
  cbosCode!: string;
}

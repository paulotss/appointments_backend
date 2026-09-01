import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TISS_VERSIONS } from '../../common/tiss-version';

export class CreateHealthPlanDto {
  @ApiProperty({ example: 'Unimed' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 30,
    description: 'Prazo padrao em dias para envio da guia ao faturamento',
  })
  @IsInt()
  @Min(1)
  submissionDeadlineDays!: number;

  @ApiPropertyOptional({ example: '123456', description: 'Registro ANS (6 digitos)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'registroAns must have 6 digits' })
  registroAns?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Codigo do prestador na operadora',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  providerCode?: string;

  @ApiPropertyOptional({
    example: '4.03.00',
    enum: TISS_VERSIONS,
    description: 'Versao do padrao TISS aceita pela operadora',
  })
  @IsOptional()
  @IsIn(TISS_VERSIONS)
  tissVersion?: string;
}

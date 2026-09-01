import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TISS_VERSIONS } from '../../common/tiss-version';

export class UpdateHealthPlanDto {
  @ApiPropertyOptional({ example: 'Unimed Nacional' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'Prazo padrao em dias para envio da guia ao faturamento',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  submissionDeadlineDays?: number;

  @ApiPropertyOptional({
    example: '123456',
    nullable: true,
    description: 'Registro ANS (6 digitos)',
  })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @Matches(/^\d{6}$/, { message: 'registroAns must have 6 digits' })
  registroAns?: string | null;

  @ApiPropertyOptional({
    example: '123456',
    nullable: true,
    description: 'Codigo do prestador na operadora',
  })
  @ValidateIf((_, value) => value != null && value !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  providerCode?: string | null;

  @ApiPropertyOptional({
    example: '4.03.00',
    enum: TISS_VERSIONS,
  })
  @IsOptional()
  @IsIn(TISS_VERSIONS)
  tissVersion?: string;
}

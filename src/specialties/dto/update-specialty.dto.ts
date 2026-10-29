import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateSpecialtyDto {
  @ApiPropertyOptional({ example: 'Cardiologia pediátrica' })
  name?: string;

  @ApiPropertyOptional({
    example: '225125',
    description: 'Codigo CBO-S (6 digitos)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'cbosCode must have 6 digits' })
  cbosCode?: string;
}

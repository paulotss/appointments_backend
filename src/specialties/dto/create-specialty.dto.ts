import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateSpecialtyDto {
  @ApiProperty({ example: 'Cardiologia' })
  name!: string;

  @ApiProperty({ example: '225125', description: 'Codigo CBO-S (6 digitos)' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'cbosCode must have 6 digits' })
  cbosCode!: string;
}

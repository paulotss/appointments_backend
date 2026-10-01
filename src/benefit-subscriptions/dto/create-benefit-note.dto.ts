import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateBenefitNoteDto {
  @ApiProperty({ example: 'Usado em retorno de nutrição' })
  @IsString()
  @MinLength(1)
  description!: string;
}

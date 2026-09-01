import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListInsuranceCardsQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por paciente' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;
}

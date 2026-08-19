import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListProceduresQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por especialidade' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Filtrar procedimentos que tenham preco cadastrado para este plano',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthPlanId?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateHealthPlanDto {
  @ApiPropertyOptional({ example: 'Unimed Nacional' })
  name?: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'Prazo padrao em dias para envio da guia ao faturamento',
  })
  submissionDeadlineDays?: number;
}

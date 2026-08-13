import { ApiProperty } from '@nestjs/swagger';

export class CreateHealthPlanDto {
  @ApiProperty({ example: 'Unimed' })
  name!: string;

  @ApiProperty({
    example: 30,
    description: 'Prazo padrao em dias para envio da guia ao faturamento',
  })
  submissionDeadlineDays!: number;
}

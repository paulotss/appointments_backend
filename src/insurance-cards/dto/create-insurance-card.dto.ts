import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInsuranceCardDto {
  @ApiProperty({ example: 1 })
  patientId!: number;

  @ApiProperty({ example: 1 })
  healthPlanId!: number;

  @ApiProperty({ example: '1234567890123456' })
  cardNumber!: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: 'Data de validade da carteirinha (YYYY-MM-DD). Opcional.',
    nullable: true,
  })
  expirationDate?: string | null;
}

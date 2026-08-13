import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInsuranceCardDto {
  @ApiPropertyOptional({ example: 1 })
  patientId?: number;

  @ApiPropertyOptional({ example: 1 })
  healthPlanId?: number;

  @ApiPropertyOptional({ example: '1234567890123456' })
  cardNumber?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: 'Data de validade da carteirinha (YYYY-MM-DD)',
  })
  expirationDate?: string;
}

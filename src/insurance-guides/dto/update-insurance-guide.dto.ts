import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInsuranceGuideDto {
  @ApiPropertyOptional({ example: 1 })
  healthPlanId?: number;

  @ApiPropertyOptional({ example: 1 })
  patientId?: number;

  @ApiPropertyOptional({ example: 1 })
  specialtyId?: number;

  @ApiPropertyOptional({ example: 1 })
  healthProfessionalId?: number;

  @ApiPropertyOptional({ example: 5 })
  quantity?: number;

  @ApiPropertyOptional({
    example: '2026-09-12',
    description: 'Data de validade da guia (YYYY-MM-DD)',
  })
  expirationDate?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: 'Indica se a guia ja foi faturada',
  })
  isBilled?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInsuranceGuideDto {
  @ApiProperty({ example: 1 })
  healthPlanId!: number;

  @ApiProperty({ example: 1 })
  patientId!: number;

  @ApiProperty({ example: 1 })
  specialtyId!: number;

  @ApiProperty({ example: 1 })
  healthProfessionalId!: number;

  @ApiProperty({ example: 5 })
  quantity!: number;

  @ApiPropertyOptional({
    example: '2026-09-12',
    description:
      'Data de validade da guia (YYYY-MM-DD). Se omitida, usa hoje + submissionDeadlineDays do plano',
  })
  expirationDate?: string;
}

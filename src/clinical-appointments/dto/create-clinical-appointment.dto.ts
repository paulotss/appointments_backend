import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BenefitEntitlementUseDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entitlementId!: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  procedureId!: number;
}

export class CreateClinicalAppointmentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId!: number;

  @ApiProperty({
    example: '2026-08-20T14:30:00.000Z',
    description: 'Data/hora de inicio do agendamento (ISO 8601)',
  })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({
    example: '2026-08-20T15:00:00.000Z',
    description: 'Data/hora de termino do agendamento (ISO 8601)',
  })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentType,
    example: ClinicalAppointmentType.private,
    description:
      'Ignorado: o tipo e derivado das origens (avulso, pacote e/ou plano).',
  })
  @IsOptional()
  @IsEnum(ClinicalAppointmentType)
  type?: ClinicalAppointmentType;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentStatus,
    example: ClinicalAppointmentStatus.marked,
    default: ClinicalAppointmentStatus.marked,
    description:
      'marked (marcado), confirmed (confirmado), waiting (em espera), attended (atendido), finished (finalizado), absent (falta)',
  })
  @IsOptional()
  @IsEnum(ClinicalAppointmentStatus)
  status?: ClinicalAppointmentStatus;

  @ApiPropertyOptional({
    example: 'Paciente solicitou horario no periodo da manha',
    description: 'Observacoes do agendamento clinico',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 11],
    description:
      'Guias de plano. Os procedimentos da guia entram como health_plan.',
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  insuranceGuideIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: 'Procedimentos particulares avulsos (preco cheio).',
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  procedureIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [5, 6],
    description: 'Itens de pacote do paciente (consome saldo, ja pagos).',
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  patientPackageItemIds?: number[];

  @ApiPropertyOptional({
    type: [BenefitEntitlementUseDto],
    description:
      'Cotas do cartão. Cada uso consome 1 saldo e não entra na cobrança particular.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BenefitEntitlementUseDto)
  benefitUses?: BenefitEntitlementUseDto[];
}

import {
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { BenefitEntitlementUseDto } from './create-clinical-appointment.dto';

export class UpdateClinicalAppointmentDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  healthProfessionalId?: number;

  @ApiPropertyOptional({
    example: '2026-08-20T14:30:00.000Z',
    description: 'Data/hora de inicio do agendamento (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    example: '2026-08-20T15:00:00.000Z',
    description: 'Data/hora de termino do agendamento (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentType,
    example: ClinicalAppointmentType.health_plan,
    description: 'Ignorado: o tipo e derivado das origens.',
  })
  @IsOptional()
  @IsEnum(ClinicalAppointmentType)
  type?: ClinicalAppointmentType;

  @ApiPropertyOptional({
    enum: ClinicalAppointmentStatus,
    example: ClinicalAppointmentStatus.finished,
  })
  @IsOptional()
  @IsEnum(ClinicalAppointmentStatus)
  status?: ClinicalAppointmentStatus;

  @ApiPropertyOptional({
    example: 'Paciente solicitou horario no periodo da manha',
    description: 'Observacoes do agendamento clinico',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 11],
    description:
      'Substitui as guias. Omita para manter. Envie [] para remover.',
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
    description: 'Substitui avulsos. Omita para manter. Envie [] para remover.',
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
    description:
      'Substitui itens de pacote. Omita para manter. Envie [] para remover.',
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
      'Substitui cotas do cartão. Omita para manter. Envie [] para remover.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BenefitEntitlementUseDto)
  benefitUses?: BenefitEntitlementUseDto[];
}

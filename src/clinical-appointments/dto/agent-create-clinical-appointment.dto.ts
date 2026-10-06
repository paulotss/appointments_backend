import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateClinicalAppointmentDto } from './create-clinical-appointment.dto';

export class AgentCreateClinicalAppointmentDto extends OmitType(
  CreateClinicalAppointmentDto,
  ['endsAt'] as const,
) {
  @ApiPropertyOptional({
    example: '2026-08-20T15:00:00.000Z',
    description:
      'Se omitido, o término é calculado pela duração da regra do procedimento.',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

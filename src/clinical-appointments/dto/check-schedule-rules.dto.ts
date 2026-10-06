import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateClinicalAppointmentDto } from './create-clinical-appointment.dto';

export class CheckScheduleRulesDto extends CreateClinicalAppointmentDto {
  @ApiPropertyOptional({
    example: 10,
    description:
      'Agendamento que está sendo editado. Não entra na contagem de vagas.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  excludeAppointmentId?: number;
}

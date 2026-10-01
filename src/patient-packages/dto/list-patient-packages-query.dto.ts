import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListPatientPackagesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Ignora reservas deste agendamento ao calcular o saldo restante',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  excludeAppointmentId?: number;
}

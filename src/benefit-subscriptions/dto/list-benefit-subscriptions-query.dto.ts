import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListBenefitSubscriptionsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional({
    example: 9,
    description: 'Agendamento a ignorar no cálculo de saldo reservado.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  excludeAppointmentId?: number;
}

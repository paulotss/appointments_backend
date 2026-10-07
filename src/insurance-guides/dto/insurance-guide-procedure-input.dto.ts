import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class InsuranceGuideProcedureInputDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  procedureId!: number;

  @ApiProperty({
    example: 10,
    description: 'Quantidade autorizada deste procedimento na guia',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorizedQuantity!: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Quantidade ja utilizada, sem agendamento. Somente admin na criacao. Se omitida, permanece 0. Ignorada na atualizacao.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usedQuantity?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['2026-09-01', '2026-09-08'],
    description:
      'Datas das sessoes realizadas (YYYY-MM-DD). Admin e colaborador. Cada data vira um agendamento finalizado.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(366)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  sessionDates?: string[];

  @ApiPropertyOptional({
    example: 80.0,
    description:
      'Valor deste procedimento na guia. Se omitido, usa o preco do plano',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;
}

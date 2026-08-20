import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

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

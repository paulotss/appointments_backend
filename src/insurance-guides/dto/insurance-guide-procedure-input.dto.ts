import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

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
}

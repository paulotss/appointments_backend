import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockUnitDto } from '../../stock/stock-unit-conversion';

export class CreateStockExitDto {
  @ApiProperty({ example: 1 })
  batchId!: number;

  @ApiProperty({
    example: 10,
    description:
      'Quantidade na unidade informada em unit. Convertida para unidade base ao debitar.',
  })
  quantity!: number;

  @ApiPropertyOptional({
    enum: StockUnitDto,
    example: StockUnitDto.UNIT,
    description:
      'Unidade da saida. BOX exige unitsPerPackage > 1 no produto do lote.',
  })
  unit: StockUnitDto = StockUnitDto.UNIT;

  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: '2026-06-12' })
  exitDate!: string;
}

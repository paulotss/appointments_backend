import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  StockUnitDto,
  ValueMode,
} from '../../stock/stock-unit-conversion';

export class CreateStockBatchDto {
  @ApiProperty({ example: 1 })
  productId!: number;

  @ApiProperty({ example: 1 })
  sectorId!: number;

  @ApiProperty({ example: 1 })
  supplierId!: number;

  @ApiProperty({
    example: 100,
    description:
      'Quantidade na unidade informada em unit. Convertida para unidade base ao gravar.',
  })
  initialQuantity!: number;

  @ApiProperty({
    enum: StockUnitDto,
    example: StockUnitDto.UNIT,
    description:
      'Unidade da quantidade de entrada. BOX exige unitsPerPackage > 1 no produto.',
  })
  unit: StockUnitDto = StockUnitDto.UNIT;

  @ApiProperty({ example: '2026-06-12' })
  movementDate!: string;

  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 1 })
  locationId!: number;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Quantidade atual na mesma unidade de unit. Default = initialQuantity.',
  })
  currentQuantity?: number;

  @ApiPropertyOptional({
    example: 150.5,
    description:
      'Valor informado conforme valueMode. Gravado como unitCost (custo por unidade base).',
  })
  value?: number;

  @ApiPropertyOptional({
    enum: ValueMode,
    example: ValueMode.PER_ENTRY_UNIT,
    description:
      'PER_ENTRY_UNIT: value e o preco da unidade de entrada (caixa ou unidade). PER_BASE_UNIT: value ja e o custo por unidade base.',
  })
  valueMode: ValueMode = ValueMode.PER_ENTRY_UNIT;

  @ApiPropertyOptional({ example: '2027-06-12' })
  expirationDate?: string;

  @ApiPropertyOptional({ example: 'Entrada via nota fiscal' })
  notes?: string;

  @ApiPropertyOptional({ example: '35260612345678901234567890123456789012345678' })
  invoiceAccessKey?: string;
}

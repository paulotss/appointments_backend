import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  StockUnitDto,
  ValueMode,
} from '../../stock/stock-unit-conversion';

export class UpdateStockBatchDto {
  @ApiPropertyOptional({ example: 1 })
  productId?: number;

  @ApiPropertyOptional({ example: 1 })
  sectorId?: number;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Quantidade na unidade informada em unit. Convertida para unidade base ao gravar.',
  })
  initialQuantity?: number;

  @ApiPropertyOptional({
    example: 80,
    description:
      'Quantidade atual na unidade informada em unit. Convertida para unidade base ao gravar.',
  })
  currentQuantity?: number;

  @ApiPropertyOptional({
    enum: StockUnitDto,
    example: StockUnitDto.UNIT,
    description:
      'Unidade das quantidades e do value nesta atualizacao. Default UNIT (ja em base).',
  })
  unit?: StockUnitDto;

  @ApiPropertyOptional({
    example: 150.5,
    description:
      'Valor conforme valueMode. Gravado como unitCost (custo por unidade base).',
  })
  value?: number;

  @ApiPropertyOptional({
    enum: ValueMode,
    example: ValueMode.PER_ENTRY_UNIT,
  })
  valueMode?: ValueMode;

  @ApiPropertyOptional({
    example: 12.5417,
    description: 'Custo por unidade base. Alternativa direta a value+valueMode.',
  })
  unitCost?: number;

  @ApiPropertyOptional({ example: '2026-06-12' })
  movementDate?: string;

  @ApiPropertyOptional({ example: '2027-06-12' })
  expirationDate?: string;

  @ApiPropertyOptional({ example: 'Observacao atualizada' })
  notes?: string;

  @ApiPropertyOptional({ example: 1 })
  userId?: number;

  @ApiPropertyOptional({ example: '35260612345678901234567890123456789012345678' })
  invoiceAccessKey?: string;

  @ApiPropertyOptional({ example: 1 })
  locationId?: number;
}

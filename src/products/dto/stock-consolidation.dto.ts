import { ApiProperty } from '@nestjs/swagger';
import { StockBatchResponseDto } from '../../stock-batches/dto/stock-batch-response.dto';

export class StockConsolidationDto {
  @ApiProperty({ example: 'Dipirona 500mg' })
  name!: string;

  @ApiProperty({ example: 'MED-DIP-500' })
  sku!: string;

  @ApiProperty({
    example: 80,
    description:
      'Soma de currentQuantity de todos os lotes abertos do produto, em unidade base',
  })
  totalQuantity!: number;

  @ApiProperty({
    example: 1004.0,
    nullable: true,
    description:
      'Valor residual do estoque: soma de currentQuantity * unitCost nos lotes com custo. Null se nenhum lote tiver unitCost.',
  })
  totalValue!: number | null;

  @ApiProperty({
    example: 12.55,
    nullable: true,
    description:
      'Media ponderada do unitCost pelo saldo (totalValue / totalQuantity). Null se nao houver valor residual.',
  })
  averagePrice!: number | null;

  @ApiProperty({
    example: 0,
    description:
      'Quantidade de lotes com estoque que vencem nos proximos 30 dias',
  })
  expiringBatchesCount!: number;

  @ApiProperty({
    example: 0,
    description: 'Quantidade de lotes com estoque vencidos',
  })
  expiredBatchesCount!: number;

  @ApiProperty({
    example: 50,
    description: 'Estoque minimo em unidade base',
  })
  minimumStock!: number;

  @ApiProperty({
    example: 'UNIT',
    description: 'Unidade base do produto',
  })
  baseUnit!: string;

  @ApiProperty({
    example: 12,
    description: 'Unidades base por caixa/embalagem',
  })
  unitsPerPackage!: number;

  @ApiProperty({
    type: StockBatchResponseDto,
    isArray: true,
    description: 'Lotes abertos (isClosed=false) com currentQuantity maior que zero',
  })
  stockBatches!: StockBatchResponseDto[];
}

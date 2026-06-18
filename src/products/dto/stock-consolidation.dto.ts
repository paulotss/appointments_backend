import { ApiProperty } from '@nestjs/swagger';
import { StockBatchResponseDto } from '../../stock-batches/dto/stock-batch-response.dto';

export class StockConsolidationDto {
  @ApiProperty({ example: 'Dipirona 500mg' })
  name!: string;

  @ApiProperty({ example: 'MED-DIP-500' })
  sku!: string;

  @ApiProperty({
    example: 80,
    description: 'Soma de currentQuantity de todos os lotes do produto',
  })
  totalQuantity!: number;

  @ApiProperty({
    example: 150.5,
    nullable: true,
    description:
      'Media dos value dos 3 lotes mais recentes (por movementDate). Null se nenhum lote tiver valor.',
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

  @ApiProperty({ example: 50 })
  minimumStock!: number;

  @ApiProperty({
    type: StockBatchResponseDto,
    isArray: true,
    description: 'Lotes abertos (isClosed=false) com currentQuantity maior que zero',
  })
  stockBatches!: StockBatchResponseDto[];
}

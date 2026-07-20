import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockBatchProductSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Dipirona 500mg' })
  name!: string;

  @ApiProperty({ example: 'MED-DIP-500' })
  sku!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 1 })
  categoryId!: number;

  @ApiProperty({ example: '2026-06-01' })
  registeredAt!: string;

  @ApiProperty({ example: 50 })
  minimumStock!: number;

  @ApiProperty({ example: 'UNIT', description: 'Unidade base do estoque' })
  baseUnit!: string;

  @ApiProperty({
    example: 12,
    description: 'Quantidade de unidades base por caixa/embalagem',
  })
  unitsPerPackage!: number;
}

export class StockBatchSectorSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Farmacia' })
  name!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-06-01' })
  registeredAt!: string;
}

export class StockBatchLocationSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Prateleira A1' })
  name!: string;
}

export class StockBatchUserSummaryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Maria Silva' })
  name!: string;

  @ApiProperty({ example: 'maria.silva' })
  usernameLogin!: string;

  @ApiProperty({ example: false })
  isAdmin!: boolean;

  @ApiPropertyOptional({ example: 2001, nullable: true })
  extension?: number | null;
}

export class StockBatchResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  productId!: number;

  @ApiProperty({ example: 1 })
  sectorId!: number;

  @ApiProperty({
    example: 100,
    description: 'Quantidade inicial em unidade base',
  })
  initialQuantity!: number;

  @ApiProperty({
    example: 80,
    description: 'Saldo atual em unidade base',
  })
  currentQuantity!: number;

  @ApiPropertyOptional({
    example: 12.5417,
    nullable: true,
    description: 'Custo por unidade base',
  })
  unitCost?: number | null;

  @ApiProperty({ example: '2026-06-01' })
  movementDate!: string;

  @ApiPropertyOptional({ example: '2027-06-01', nullable: true })
  expirationDate?: string | null;

  @ApiPropertyOptional({ example: 'Entrada via nota fiscal', nullable: true })
  notes?: string | null;

  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiPropertyOptional({
    example: '35260612345678901234567890123456789012345678',
    nullable: true,
  })
  invoiceAccessKey?: string | null;

  @ApiProperty({ example: 1 })
  locationId!: number;

  @ApiProperty({
    example: false,
    description:
      'Indica se o lote esta fechado. Fechado automaticamente quando currentQuantity chega a 0.',
  })
  isClosed!: boolean;

  @ApiProperty({ type: StockBatchProductSummaryDto })
  product!: StockBatchProductSummaryDto;

  @ApiProperty({ type: StockBatchSectorSummaryDto })
  sector!: StockBatchSectorSummaryDto;

  @ApiProperty({ type: StockBatchLocationSummaryDto })
  location!: StockBatchLocationSummaryDto;

  @ApiProperty({ type: StockBatchUserSummaryDto })
  user!: StockBatchUserSummaryDto;
}

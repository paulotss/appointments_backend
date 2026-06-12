import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStockBatchDto {
  @ApiPropertyOptional({ example: 1 })
  productId?: number;

  @ApiPropertyOptional({ example: 1 })
  sectorId?: number;

  @ApiPropertyOptional({ example: 100 })
  initialQuantity?: number;

  @ApiPropertyOptional({ example: 80 })
  currentQuantity?: number;

  @ApiPropertyOptional({ example: 150.5 })
  value?: number;

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

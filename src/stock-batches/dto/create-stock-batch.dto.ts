import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStockBatchDto {
  @ApiProperty({ example: 1 })
  productId!: number;

  @ApiProperty({ example: 1 })
  sectorId!: number;

  @ApiProperty({ example: 100 })
  initialQuantity!: number;

  @ApiProperty({ example: '2026-06-12' })
  movementDate!: string;

  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 1 })
  locationId!: number;

  @ApiPropertyOptional({ example: 100 })
  currentQuantity?: number;

  @ApiPropertyOptional({ example: 150.5 })
  value?: number;

  @ApiPropertyOptional({ example: '2027-06-12' })
  expirationDate?: string;

  @ApiPropertyOptional({ example: 'Entrada via nota fiscal' })
  notes?: string;

  @ApiPropertyOptional({ example: '35260612345678901234567890123456789012345678' })
  invoiceAccessKey?: string;
}

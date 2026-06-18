import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Dipirona 500mg - caixa' })
  name?: string;

  @ApiPropertyOptional({ example: 'MED-DIP-500-BOX' })
  sku?: string;

  @ApiPropertyOptional({ example: 1 })
  categoryId?: number;

  @ApiPropertyOptional({ example: 50 })
  minimumStock?: number;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;
}

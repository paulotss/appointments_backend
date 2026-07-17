import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Dipirona 500mg' })
  name?: string;

  @ApiPropertyOptional({ example: 'MED-DIP-500' })
  sku?: string;

  @ApiPropertyOptional({ example: 1 })
  categoryId?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Estoque minimo em unidade base',
  })
  minimumStock?: number;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Quantidade de unidades base por caixa. 1 = produto sem embalagem util.',
  })
  unitsPerPackage?: number;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;
}

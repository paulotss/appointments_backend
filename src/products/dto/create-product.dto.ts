import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Dipirona 500mg' })
  name!: string;

  @ApiProperty({ example: 'MED-DIP-500' })
  sku!: string;

  @ApiProperty({ example: 1 })
  categoryId!: number;

  @ApiProperty({
    example: 50,
    description: 'Estoque minimo em unidade base',
  })
  minimumStock!: number;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Quantidade de unidades base por caixa. 1 = produto sem embalagem util.',
  })
  unitsPerPackage?: number;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

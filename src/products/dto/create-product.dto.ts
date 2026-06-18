import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Dipirona 500mg' })
  name!: string;

  @ApiProperty({ example: 'MED-DIP-500' })
  sku!: string;

  @ApiProperty({ example: 1 })
  categoryId!: number;

  @ApiProperty({ example: 50 })
  minimumStock!: number;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

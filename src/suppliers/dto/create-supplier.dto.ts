import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora Farma Brasil LTDA' })
  legalName!: string;

  @ApiProperty({ example: 'Farma Brasil' })
  tradeName!: string;

  @ApiProperty({ example: '12345678000199' })
  cnpj!: string;

  @ApiProperty({ example: '1133334444' })
  phone!: string;

  @ApiProperty({ example: 'contato@farmabrasil.local' })
  email!: string;

  @ApiPropertyOptional({ example: 'https://farmabrasil.local' })
  website?: string;
}

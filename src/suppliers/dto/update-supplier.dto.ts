import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Distribuidora Farma Brasil LTDA' })
  legalName?: string;

  @ApiPropertyOptional({ example: 'Farma Brasil' })
  tradeName?: string;

  @ApiPropertyOptional({ example: '12345678000199' })
  cnpj?: string;

  @ApiPropertyOptional({ example: '1133334444' })
  phone?: string;

  @ApiPropertyOptional({ example: 'contato@farmabrasil.local' })
  email?: string;

  @ApiPropertyOptional({ example: 'https://farmabrasil.local', nullable: true })
  website?: string | null;
}

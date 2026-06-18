import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSectorDto {
  @ApiPropertyOptional({ example: 'Almoxarifado Central' })
  name?: string;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;
}

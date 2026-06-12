import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorageLocationDto {
  @ApiPropertyOptional({ example: 'Prateleira A2' })
  name?: string;
}

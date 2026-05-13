import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSpecialtyDto {
  @ApiPropertyOptional({ example: 'Cardiologia pediátrica' })
  name?: string;
}

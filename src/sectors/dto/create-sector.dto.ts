import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSectorDto {
  @ApiProperty({ example: 'Farmacia' })
  name!: string;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

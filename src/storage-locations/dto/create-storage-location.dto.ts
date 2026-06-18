import { ApiProperty } from '@nestjs/swagger';

export class CreateStorageLocationDto {
  @ApiProperty({ example: 'Prateleira A1' })
  name!: string;
}

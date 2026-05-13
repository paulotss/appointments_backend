import { ApiProperty } from '@nestjs/swagger';

export class CreateSpecialtyDto {
  @ApiProperty({ example: 'Cardiologia' })
  name!: string;
}

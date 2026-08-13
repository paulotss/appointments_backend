import { ApiProperty } from '@nestjs/swagger';

export class HealthProfessionalSpecialtyInputDto {
  @ApiProperty({ example: 1 })
  specialtyId!: number;

  @ApiProperty({ example: 250.0, description: 'Preco particular' })
  privatePrice!: number;
}

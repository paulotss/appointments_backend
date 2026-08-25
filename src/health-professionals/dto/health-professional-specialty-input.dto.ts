import { ApiProperty } from '@nestjs/swagger';

export class HealthProfessionalSpecialtyInputDto {
  @ApiProperty({ example: 1 })
  specialtyId!: number;
}

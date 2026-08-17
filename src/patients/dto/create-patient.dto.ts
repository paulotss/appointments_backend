import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'Maria Silva' })
  name!: string;

  @ApiProperty({ example: '11999998888' })
  phone!: string;

  @ApiPropertyOptional({ example: 'maria.silva@email.com' })
  email?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Data de nascimento (YYYY-MM-DD)',
  })
  birthDate?: string;

  @ApiPropertyOptional({ example: '52998224725', description: 'CPF com 11 digitos' })
  cpf?: string;
}

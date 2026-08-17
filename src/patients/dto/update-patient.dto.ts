import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePatientDto {
  @ApiPropertyOptional({ example: 'Maria Silva Santos' })
  name?: string;

  @ApiPropertyOptional({ example: '11988887777' })
  phone?: string;

  @ApiPropertyOptional({ example: 'maria.silva@email.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Data de nascimento (YYYY-MM-DD)',
    nullable: true,
  })
  birthDate?: string | null;

  @ApiPropertyOptional({ example: '52998224725', nullable: true })
  cpf?: string | null;
}

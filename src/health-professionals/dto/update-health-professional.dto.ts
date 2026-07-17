import { ApiPropertyOptional } from '@nestjs/swagger';
import { CouncilType } from '@prisma/client';

export class UpdateHealthProfessionalDto {
  @ApiPropertyOptional({ example: 'Dr. Joao Silva' })
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  specialtyId?: number;

  @ApiPropertyOptional({ enum: CouncilType, example: CouncilType.CRM })
  councilType?: CouncilType;

  @ApiPropertyOptional({ example: '123456' })
  councilNumber?: string;

  @ApiPropertyOptional({ example: '52998224725' })
  cpf?: string;

  @ApiPropertyOptional({ example: '11999998888', nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'joao.silva@email.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;
}

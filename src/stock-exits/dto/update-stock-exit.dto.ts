import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStockExitDto {
  @ApiPropertyOptional({ example: 1 })
  batchId?: number;

  @ApiPropertyOptional({ example: 10 })
  quantity?: number;

  @ApiPropertyOptional({ example: 1 })
  userId?: number;

  @ApiPropertyOptional({ example: '2026-06-12' })
  exitDate?: string;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description:
      'Profissional da saude que fez a saida. Envie null para limpar o vinculo.',
  })
  healthProfessionalId?: number | null;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateGeneratedPatientFileDto {
  @ApiProperty({
    description: 'Conteúdo estruturado do receituário ou do pedido médico',
  })
  @IsObject()
  content!: Record<string, unknown>;
}

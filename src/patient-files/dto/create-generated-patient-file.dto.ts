import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';

export class CreateGeneratedPatientFileDto {
  @ApiProperty({
    enum: ['MEDICAL_ORDER', 'PRESCRIPTION'],
    example: 'PRESCRIPTION',
  })
  @IsIn(['MEDICAL_ORDER', 'PRESCRIPTION'])
  kind!: 'MEDICAL_ORDER' | 'PRESCRIPTION';

  @ApiProperty({
    description: 'Conteúdo estruturado do receituário ou do pedido médico',
  })
  @IsObject()
  content!: Record<string, unknown>;
}

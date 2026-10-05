import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceTokenScope } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceTokenDto {
  @ApiProperty({ example: 'Tarifador PABX' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    enum: ServiceTokenScope,
    isArray: true,
    example: [ServiceTokenScope.CALLS_WRITE],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ServiceTokenScope, { each: true })
  scopes!: ServiceTokenScope[];

  @ApiPropertyOptional({
    example: 365,
    description: 'Validade em dias. Padrão: 365.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProcedurePackageItemInputDto } from './procedure-package-item-input.dto';

export class CreateProcedurePackageDto {
  @ApiProperty({ example: 'Pacote fisioterapia 10 sessoes' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 10,
    description: 'Desconto percentual aplicado ao valor de cada procedimento',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent!: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    type: [ProcedurePackageItemInputDto],
    example: [{ procedureId: 1, quantity: 10 }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcedurePackageItemInputDto)
  items!: ProcedurePackageItemInputDto[];
}

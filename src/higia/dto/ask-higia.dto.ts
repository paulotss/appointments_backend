import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class HigiaHistoryMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Quantos pacientes temos hoje?' })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AskHigiaDto {
  @ApiProperty({ example: 'Quem esta na agenda hoje?' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question!: string;

  @ApiPropertyOptional({ type: [HigiaHistoryMessageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => HigiaHistoryMessageDto)
  history?: HigiaHistoryMessageDto[];
}

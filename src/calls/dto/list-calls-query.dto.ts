import { CallRecordStatus, CallStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ListCallsQueryDto {
  @ApiProperty({ example: '2026-07-31', description: 'YYYY-MM-DD (inclusivo)' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-07-31', description: 'YYYY-MM-DD (inclusivo)' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ enum: CallRecordStatus })
  @IsOptional()
  @IsEnum(CallRecordStatus)
  recordStatus?: CallRecordStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({
    example: 'ATENDIDO,NAO_ATENDIDO',
    description: 'CSV de CallStatus',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsEnum(CallStatus, { each: true })
  statuses?: CallStatus[];

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

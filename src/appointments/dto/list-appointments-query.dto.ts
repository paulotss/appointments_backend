import { ContactMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

export class ListAppointmentsQueryDto {
  @ApiProperty({ example: '2026-07-01', description: 'YYYY-MM-DD (inclusivo)' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-07-31', description: 'YYYY-MM-DD (inclusivo)' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendantId?: number;

  @ApiPropertyOptional({ enum: ContactMethod })
  @IsOptional()
  @IsEnum(ContactMethod)
  contactMethod?: ContactMethod;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  firstTime?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  scheduled?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;

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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { WeeklyBlockInputDto } from './weekly-block-input.dto';

export class ScheduleRuleInputDto {
  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  procedureId!: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxConcurrentAppointments!: number;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slotIntervalMinutes!: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  allowOverbooking!: boolean;

  @ApiPropertyOptional({ example: 'Sala compartilhada', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ApiProperty({ type: [WeeklyBlockInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WeeklyBlockInputDto)
  windows!: WeeklyBlockInputDto[];
}

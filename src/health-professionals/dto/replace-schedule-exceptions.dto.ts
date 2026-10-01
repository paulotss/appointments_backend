import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, Matches, ValidateNested } from 'class-validator';
import { ScheduleExceptionInputDto } from './schedule-exception-input.dto';

export class ReplaceScheduleExceptionsDto {
  @ApiProperty({ example: '2026-10-05' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ type: [ScheduleExceptionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleExceptionInputDto)
  exceptions!: ScheduleExceptionInputDto[];
}

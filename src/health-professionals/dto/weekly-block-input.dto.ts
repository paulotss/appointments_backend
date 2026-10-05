import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';

export class WeeklyBlockInputDto {
  @ApiProperty({ example: 1, description: '0 domingo ... 6 sabado' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm',
  })
  startTime!: string;

  @ApiProperty({ example: '14:00', description: 'HH:mm, 24:00 apenas no fim' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm',
  })
  endTime!: string;
}

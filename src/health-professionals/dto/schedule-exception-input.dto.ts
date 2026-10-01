import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ScheduleExceptionInputDto {
  @ApiProperty({ enum: ['block', 'release'], example: 'block' })
  @IsIn(['block', 'release'])
  kind!: 'block' | 'release';

  @ApiProperty({ example: '08:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:mm',
  })
  startTime!: string;

  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, {
    message: 'endTime must be HH:mm',
  })
  endTime!: string;

  @ApiPropertyOptional({ example: 'Atestado', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

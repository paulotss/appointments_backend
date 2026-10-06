import { Module } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';

@Module({
  providers: [ScheduleRulesService],
  exports: [ScheduleRulesService],
})
export class ScheduleRulesModule {}

import { ConflictException } from '@nestjs/common';
import { ScheduleRuleWarning } from './schedule-rules.evaluate';

export function assertAgentMayBook(warnings: ScheduleRuleWarning[]): void {
  if (warnings.length === 0) {
    return;
  }
  throw new ConflictException({
    message: 'Appointment is outside the professional schedule rules',
    warnings,
  });
}

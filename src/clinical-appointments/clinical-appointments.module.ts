import { Module } from '@nestjs/common';
import { HealthProfessionalsModule } from '../health-professionals/health-professionals.module';
import { ScheduleRulesModule } from '../schedule-rules/schedule-rules.module';
import { ClinicalAppointmentsController } from './clinical-appointments.controller';
import { ClinicalAppointmentsService } from './clinical-appointments.service';

@Module({
  imports: [HealthProfessionalsModule, ScheduleRulesModule],
  controllers: [ClinicalAppointmentsController],
  providers: [ClinicalAppointmentsService],
  exports: [ClinicalAppointmentsService],
})
export class ClinicalAppointmentsModule {}

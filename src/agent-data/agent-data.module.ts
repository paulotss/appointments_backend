import { Module } from '@nestjs/common';
import { BenefitSubscriptionsModule } from '../benefit-subscriptions/benefit-subscriptions.module';
import { ClinicalAppointmentsModule } from '../clinical-appointments/clinical-appointments.module';
import { PatientPackagesModule } from '../patient-packages/patient-packages.module';
import { ScheduleRulesModule } from '../schedule-rules/schedule-rules.module';
import { AgentDataController } from './agent-data.controller';
import { AgentDataService } from './agent-data.service';

@Module({
  imports: [
    BenefitSubscriptionsModule,
    ClinicalAppointmentsModule,
    PatientPackagesModule,
    ScheduleRulesModule,
  ],
  controllers: [AgentDataController],
  providers: [AgentDataService],
  exports: [AgentDataService],
})
export class AgentDataModule {}

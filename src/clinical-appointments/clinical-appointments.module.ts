import { Module } from '@nestjs/common';
import { HealthProfessionalsModule } from '../health-professionals/health-professionals.module';
import { ClinicalAppointmentsController } from './clinical-appointments.controller';
import { ClinicalAppointmentsService } from './clinical-appointments.service';

@Module({
  imports: [HealthProfessionalsModule],
  controllers: [ClinicalAppointmentsController],
  providers: [ClinicalAppointmentsService],
})
export class ClinicalAppointmentsModule {}

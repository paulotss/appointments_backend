import { Module } from '@nestjs/common';
import { ClinicalAppointmentsController } from './clinical-appointments.controller';
import { ClinicalAppointmentsService } from './clinical-appointments.service';

@Module({
  controllers: [ClinicalAppointmentsController],
  providers: [ClinicalAppointmentsService],
})
export class ClinicalAppointmentsModule {}

import { Module } from '@nestjs/common';
import { PatientPackagesController } from './patient-packages.controller';
import { PatientPackagesService } from './patient-packages.service';

@Module({
  controllers: [PatientPackagesController],
  providers: [PatientPackagesService],
})
export class PatientPackagesModule {}

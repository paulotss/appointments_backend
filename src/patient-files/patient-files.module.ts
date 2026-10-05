import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { PatientFilesController } from './patient-files.controller';
import { PatientFilesService } from './patient-files.service';

@Module({
  imports: [UploadsModule],
  controllers: [PatientFilesController],
  providers: [PatientFilesService],
})
export class PatientFilesModule {}

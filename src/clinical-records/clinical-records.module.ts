import { Module } from '@nestjs/common';
import { ClinicalRecordsController } from './clinical-records.controller';
import { ClinicalRecordsService } from './clinical-records.service';

@Module({
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService],
})
export class ClinicalRecordsModule {}

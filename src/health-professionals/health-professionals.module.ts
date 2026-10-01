import { Module } from '@nestjs/common';
import { HealthProfessionalsController } from './health-professionals.controller';
import { HealthProfessionalsService } from './health-professionals.service';

@Module({
  controllers: [HealthProfessionalsController],
  providers: [HealthProfessionalsService],
  exports: [HealthProfessionalsService],
})
export class HealthProfessionalsModule {}

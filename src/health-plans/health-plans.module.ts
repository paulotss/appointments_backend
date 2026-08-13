import { Module } from '@nestjs/common';
import { HealthPlansController } from './health-plans.controller';
import { HealthPlansService } from './health-plans.service';

@Module({
  controllers: [HealthPlansController],
  providers: [HealthPlansService],
})
export class HealthPlansModule {}

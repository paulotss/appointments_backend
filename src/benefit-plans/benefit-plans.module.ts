import { Module } from '@nestjs/common';
import { BenefitPlansController } from './benefit-plans.controller';
import { BenefitPlansService } from './benefit-plans.service';

@Module({
  controllers: [BenefitPlansController],
  providers: [BenefitPlansService],
})
export class BenefitPlansModule {}

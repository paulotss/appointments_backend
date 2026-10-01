import { Module } from '@nestjs/common';
import { BenefitSubscriptionsController } from './benefit-subscriptions.controller';
import { BenefitSubscriptionsService } from './benefit-subscriptions.service';

@Module({
  controllers: [BenefitSubscriptionsController],
  providers: [BenefitSubscriptionsService],
  exports: [BenefitSubscriptionsService],
})
export class BenefitSubscriptionsModule {}

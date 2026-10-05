import { Module } from '@nestjs/common';
import { BenefitSubscriptionsModule } from '../benefit-subscriptions/benefit-subscriptions.module';
import { FinancialEntriesController } from './financial-entries.controller';
import { FinancialEntriesService } from './financial-entries.service';

@Module({
  imports: [BenefitSubscriptionsModule],
  controllers: [FinancialEntriesController],
  providers: [FinancialEntriesService],
})
export class FinancialEntriesModule {}

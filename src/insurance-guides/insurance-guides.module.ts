import { Module } from '@nestjs/common';
import { BillingBatchesModule } from '../billing-batches/billing-batches.module';
import { InsuranceGuidesController } from './insurance-guides.controller';
import { InsuranceGuidesService } from './insurance-guides.service';

@Module({
  imports: [BillingBatchesModule],
  controllers: [InsuranceGuidesController],
  providers: [InsuranceGuidesService],
})
export class InsuranceGuidesModule {}

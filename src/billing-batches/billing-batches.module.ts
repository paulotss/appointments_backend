import { Module } from '@nestjs/common';
import { BillingBatchesController } from './billing-batches.controller';
import { BillingBatchesService } from './billing-batches.service';

@Module({
  controllers: [BillingBatchesController],
  providers: [BillingBatchesService],
})
export class BillingBatchesModule {}

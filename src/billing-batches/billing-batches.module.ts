import { Module } from '@nestjs/common';
import { TissExportModule } from '../tiss-export/tiss-export.module';
import { BillingBatchesController } from './billing-batches.controller';
import { BillingBatchesService } from './billing-batches.service';

@Module({
  imports: [TissExportModule],
  controllers: [BillingBatchesController],
  providers: [BillingBatchesService],
  exports: [BillingBatchesService],
})
export class BillingBatchesModule {}

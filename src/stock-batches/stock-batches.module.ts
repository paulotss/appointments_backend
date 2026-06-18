import { Module } from '@nestjs/common';
import { StockBatchesController } from './stock-batches.controller';
import { StockBatchesService } from './stock-batches.service';

@Module({
  controllers: [StockBatchesController],
  providers: [StockBatchesService],
})
export class StockBatchesModule {}

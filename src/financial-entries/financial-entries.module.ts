import { Module } from '@nestjs/common';
import { FinancialEntriesController } from './financial-entries.controller';
import { FinancialEntriesService } from './financial-entries.service';

@Module({
  controllers: [FinancialEntriesController],
  providers: [FinancialEntriesService],
})
export class FinancialEntriesModule {}

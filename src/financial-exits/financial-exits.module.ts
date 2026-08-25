import { Module } from '@nestjs/common';
import { FinancialExitsController } from './financial-exits.controller';
import { FinancialExitsService } from './financial-exits.service';

@Module({
  controllers: [FinancialExitsController],
  providers: [FinancialExitsService],
})
export class FinancialExitsModule {}

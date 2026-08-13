import { Module } from '@nestjs/common';
import { InsuranceCardsController } from './insurance-cards.controller';
import { InsuranceCardsService } from './insurance-cards.service';

@Module({
  controllers: [InsuranceCardsController],
  providers: [InsuranceCardsService],
})
export class InsuranceCardsModule {}

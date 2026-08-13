import { Module } from '@nestjs/common';
import { InsuranceGuidesController } from './insurance-guides.controller';
import { InsuranceGuidesService } from './insurance-guides.service';

@Module({
  controllers: [InsuranceGuidesController],
  providers: [InsuranceGuidesService],
})
export class InsuranceGuidesModule {}

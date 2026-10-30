import { Module } from '@nestjs/common';
import { RequestingProfessionalsController } from './requesting-professionals.controller';
import { RequestingProfessionalsService } from './requesting-professionals.service';

@Module({
  controllers: [RequestingProfessionalsController],
  providers: [RequestingProfessionalsService],
  exports: [RequestingProfessionalsService],
})
export class RequestingProfessionalsModule {}

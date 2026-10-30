import { Module } from '@nestjs/common';
import { TissCatalogController } from './tiss-catalog.controller';

@Module({
  controllers: [TissCatalogController],
})
export class TissCatalogModule {}

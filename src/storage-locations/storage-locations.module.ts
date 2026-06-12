import { Module } from '@nestjs/common';
import { StorageLocationsController } from './storage-locations.controller';
import { StorageLocationsService } from './storage-locations.service';

@Module({
  controllers: [StorageLocationsController],
  providers: [StorageLocationsService],
})
export class StorageLocationsModule {}

import { Module } from '@nestjs/common';
import { PortalRagController } from './portal-rag.controller';
import { PortalRagService } from './portal-rag.service';

@Module({
  controllers: [PortalRagController],
  providers: [PortalRagService],
})
export class PortalRagModule {}

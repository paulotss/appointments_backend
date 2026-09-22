import { Module } from '@nestjs/common';
import { AgentDataController } from './agent-data.controller';
import { AgentDataService } from './agent-data.service';

@Module({
  controllers: [AgentDataController],
  providers: [AgentDataService],
  exports: [AgentDataService],
})
export class AgentDataModule {}

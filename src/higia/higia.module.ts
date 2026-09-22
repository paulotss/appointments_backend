import { Module } from '@nestjs/common';
import { AgentDataModule } from '../agent-data/agent-data.module';
import { HigiaController } from './higia.controller';
import { HigiaService } from './higia.service';

@Module({
  imports: [AgentDataModule],
  controllers: [HigiaController],
  providers: [HigiaService],
})
export class HigiaModule {}

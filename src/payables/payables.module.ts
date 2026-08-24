import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { PayablesController } from './payables.controller';
import { PayablesService } from './payables.service';

@Module({
  imports: [UploadsModule],
  controllers: [PayablesController],
  providers: [PayablesService],
})
export class PayablesModule {}

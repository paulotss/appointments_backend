import { Module } from '@nestjs/common';
import { TissExportService } from './tiss-export.service';

@Module({
  providers: [TissExportService],
  exports: [TissExportService],
})
export class TissExportModule {}

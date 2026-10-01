import { Module } from '@nestjs/common';
import { ProcedurePackagesController } from './procedure-packages.controller';
import { ProcedurePackagesService } from './procedure-packages.service';

@Module({
  controllers: [ProcedurePackagesController],
  providers: [ProcedurePackagesService],
})
export class ProcedurePackagesModule {}

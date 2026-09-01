import { Module } from '@nestjs/common';
import { ClinicProfileController } from './clinic-profile.controller';
import { ClinicProfileService } from './clinic-profile.service';

@Module({
  controllers: [ClinicProfileController],
  providers: [ClinicProfileService],
  exports: [ClinicProfileService],
})
export class ClinicProfileModule {}

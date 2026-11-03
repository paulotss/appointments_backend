import { Module } from '@nestjs/common';
import {
  ClinicRegistryReadController,
  ConfirmationCampaignsController,
  ContactRegistryController,
} from './confirmation-admin.controller';
import { ConfirmationAdminService } from './confirmation-admin.service';

@Module({
  controllers: [
    ConfirmationCampaignsController,
    ContactRegistryController,
    ClinicRegistryReadController,
  ],
  providers: [ConfirmationAdminService],
})
export class ConfirmationAdminModule {}

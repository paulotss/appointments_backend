import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ClinicRegistryReadController,
  ConfirmationCampaignsController,
  ContactRegistryController,
} from './confirmation-admin.controller';
import { ConfirmationAdminService } from './confirmation-admin.service';
import {
  AppointmentSourceRegistry,
  CampaignContactClassifier,
  HttpCampaignContactClassifier,
  defaultAppointmentSources,
  httpCampaignSourceClient,
} from './appointment-source';

@Module({
  imports: [PrismaModule],
  controllers: [
    ConfirmationCampaignsController,
    ContactRegistryController,
    ClinicRegistryReadController,
  ],
  providers: [
    ConfirmationAdminService,
    {
      provide: AppointmentSourceRegistry,
      useFactory: () => defaultAppointmentSources(httpCampaignSourceClient()),
    },
    {
      provide: CampaignContactClassifier,
      useFactory: () =>
        new HttpCampaignContactClassifier(httpCampaignSourceClient()),
    },
  ],
})
export class ConfirmationAdminModule {}

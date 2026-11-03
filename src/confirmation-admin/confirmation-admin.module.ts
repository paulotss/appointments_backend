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
  CAMPAIGN_IDENTITY,
  CampaignContactClassifier,
  HttpCampaignContactClassifier,
  defaultAppointmentSources,
  httpCampaignIdentityClient,
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
    {
      provide: CAMPAIGN_IDENTITY,
      useFactory: () => httpCampaignIdentityClient(),
    },
  ],
})
export class ConfirmationAdminModule {}

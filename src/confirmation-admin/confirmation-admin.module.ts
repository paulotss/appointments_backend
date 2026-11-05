import { ConfirmationResultsService } from './confirmation-results.service';
import {
  ConfirmationResultsController,
  ConfirmationResponseAdminController,
} from './confirmation-results.controller';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ClinicRegistryReadController,
  ConfirmationCampaignsController,
  ContactRegistryController,
} from './confirmation-admin.controller';
import { ConfirmationAdminService } from './confirmation-admin.service';
import { ConfirmationSimulationService } from './confirmation-simulation.service';
import { ConfirmationExecutionService } from './confirmation-execution.service';
import { ConfirmationExecutionController } from './confirmation-execution.controller';
import {
  ConfirmationSimulationController,
  ConfirmationSimulationHistoryController,
} from './confirmation-simulation.controller';
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
    ConfirmationSimulationController,
    ConfirmationSimulationHistoryController,
    ConfirmationExecutionController,
    ConfirmationResultsController,
    ConfirmationResponseAdminController,
  ],
  providers: [
    ConfirmationAdminService,
    ConfirmationSimulationService,
    ConfirmationExecutionService,
    ConfirmationResultsService,
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

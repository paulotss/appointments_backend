import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import { STAFF_ROLES } from '../auth/roles';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { ConfirmationResultsService } from './confirmation-results.service';

@Controller('confirmation-results')
@ServiceScopes(ServiceTokenScope.CONFIRMATION_RESULTS_WRITE)
export class ConfirmationResultsController {
  constructor(private readonly results: ConfirmationResultsService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  ingest(@CurrentUser() actor: AuthPrincipal, @Body() body: unknown) {
    return this.results.ingest(actor, body);
  }
}
@Controller('confirmation-campaigns/:campaignId/responses')
@Roles(...STAFF_ROLES)
export class ConfirmationResponseAdminController {
  constructor(private readonly results: ConfirmationResultsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() actor: AuthPrincipal,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    return this.results.list(actor, campaignId);
  }
  @Post('pending/:id/assign')
  assign(
    @CurrentUser() actor: AuthPrincipal,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.results.act(actor, campaignId, id, body, 'ASSIGN');
  }
  @Post('pending/:id/complete')
  complete(
    @CurrentUser() actor: AuthPrincipal,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.results.act(actor, campaignId, id, body, 'COMPLETE');
  }
}

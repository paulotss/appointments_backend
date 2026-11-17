import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { STAFF_ROLES } from '../auth/roles';
import { ConfirmationSendReleaseService } from './confirmation-send-release.service';

@Controller('confirmation-campaigns/:id/send-release')
@Roles(...STAFF_ROLES)
export class ConfirmationSendReleaseController {
  constructor(private readonly releases: ConfirmationSendReleaseService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  state(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.releases.state(actor, id);
  }
  @Post() release(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.releases.change(actor, id, body);
  }
  @Post('pause') pause(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.releases.change(actor, id, body, true);
  }
}

@Controller('confirmation-send-queue')
@ServiceScopes(ServiceTokenScope.CONFIRMATION_EXECUTION_READ)
export class ConfirmationSendQueueController {
  constructor(private readonly releases: ConfirmationSendReleaseService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  queue(@CurrentUser() actor: AuthPrincipal) {
    return this.releases.queue(actor);
  }
  @Post(':id/items/:itemId/permit')
  @Header('Cache-Control', 'no-store')
  permit(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: unknown,
  ) {
    if (
      !body ||
      typeof body !== 'object' ||
      Object.keys(body).join() !== 'revision' ||
      !('revision' in body) ||
      typeof body.revision !== 'string'
    )
      return { ready: false };
    return this.releases.permit(actor, id, itemId, body.revision);
  }
}

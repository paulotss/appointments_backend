import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { STAFF_ROLES } from '../auth/roles';
import { ConfirmationSimulationService } from './confirmation-simulation.service';

@Controller('confirmation-simulations')
@ServiceScopes(ServiceTokenScope.CONFIRMATION_SIMULATE)
export class ConfirmationSimulationController {
  constructor(private readonly simulations: ConfirmationSimulationService) {}
  @Post('campaigns/:id')
  @Header('Cache-Control', 'no-store')
  begin(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.simulations.begin(actor, id);
  }
  @Post(':id/items/:itemId/check')
  @Header('Cache-Control', 'no-store')
  check(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Headers('x-simulation-claim') claim: string,
  ) {
    return this.simulations.check(actor, id, itemId, claim);
  }
  @Post(':id/result')
  @Header('Cache-Control', 'no-store')
  complete(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-simulation-claim') claim: string,
    @Body() body: unknown,
  ) {
    return this.simulations.complete(actor, id, claim, body);
  }
}

@Controller('confirmation-campaigns')
@Roles(...STAFF_ROLES)
export class ConfirmationSimulationHistoryController {
  constructor(private readonly simulations: ConfirmationSimulationService) {}
  @Get(':id/simulations')
  @Header('Cache-Control', 'no-store')
  list(@Param('id', ParseIntPipe) id: number) {
    return this.simulations.list(id);
  }
}

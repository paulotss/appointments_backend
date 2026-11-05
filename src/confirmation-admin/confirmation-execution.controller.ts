import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ServiceTokenScope } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { ConfirmationExecutionService } from './confirmation-execution.service';

@Controller('confirmation-execution')
@ServiceScopes(ServiceTokenScope.CONFIRMATION_EXECUTION_READ)
export class ConfirmationExecutionController {
  constructor(private readonly execution: ConfirmationExecutionService) {}
  @Get('campaigns/:id')
  @Header('Cache-Control', 'no-store')
  snapshot(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.execution.snapshot(actor, id);
  }
  @Post('campaigns/:id/items/:itemId/check')
  @Header('Cache-Control', 'no-store')
  check(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: unknown,
  ) {
    if (
      !body ||
      typeof body !== 'object' ||
      Object.keys(body).join(',') !== 'revision' ||
      !('revision' in body) ||
      typeof body.revision !== 'string' ||
      !/^[0-9a-f]{64}$/.test(body.revision)
    )
      throw new BadRequestException('Revisão inválida.');
    return this.execution.check(actor, id, itemId, body.revision);
  }
}

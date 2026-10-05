import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceTokenScope } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import { STAFF_ROLES } from '../auth/roles';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';
import { UpdateCallDto } from './dto/update-call.dto';

@ApiTags('calls')
@Roles(...STAFF_ROLES)
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  @ServiceScopes(ServiceTokenScope.CALLS_WRITE)
  @ApiOperation({ summary: 'Registrar ligação' })
  create(@Body() createCallDto: CreateCallDto) {
    return this.callsService.create(createCallDto);
  }

  @Get()
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Listar ligações (filtrado, paginado, com counts)',
  })
  findAll(
    @Query() query: ListCallsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.callsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar ligação por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.callsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar ligação' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCallDto: UpdateCallDto,
  ) {
    return this.callsService.update(id, updateCallDto);
  }
}

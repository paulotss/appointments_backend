import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';
import { UpdateCallDto } from './dto/update-call.dto';

@ApiTags('calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar ligação' })
  create(@Body() createCallDto: CreateCallDto) {
    return this.callsService.create(createCallDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
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

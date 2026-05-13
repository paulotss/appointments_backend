import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
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
  @ApiOperation({ summary: 'Listar ligações' })
  findAll() {
    return this.callsService.findAll();
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

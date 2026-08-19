import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { ListProceduresQueryDto } from './dto/list-procedures-query.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { ProceduresService } from './procedures.service';

@ApiTags('procedures')
@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Post()
  @ApiOperation({ summary: 'Criar procedimento' })
  create(@Body() createProcedureDto: CreateProcedureDto) {
    return this.proceduresService.create(createProcedureDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar procedimentos',
    description:
      'Filtre por specialtyId e/ou healthPlanId (procedimentos com preco no plano).',
  })
  findAll(@Query() query: ListProceduresQueryDto) {
    return this.proceduresService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar procedimento por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.proceduresService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar procedimento' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProcedureDto: UpdateProcedureDto,
  ) {
    return this.proceduresService.update(id, updateProcedureDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover procedimento' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proceduresService.remove(id);
  }
}

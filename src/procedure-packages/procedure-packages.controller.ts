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
import { CreateProcedurePackageDto } from './dto/create-procedure-package.dto';
import { ListProcedurePackagesQueryDto } from './dto/list-procedure-packages-query.dto';
import { UpdateProcedurePackageDto } from './dto/update-procedure-package.dto';
import { ProcedurePackagesService } from './procedure-packages.service';

@ApiTags('procedure-packages')
@Controller('procedure-packages')
export class ProcedurePackagesController {
  constructor(
    private readonly procedurePackagesService: ProcedurePackagesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar pacote de procedimentos',
    description:
      'O desconto percentual e aplicado ao valor particular de cada procedimento.',
  })
  create(@Body() dto: CreateProcedurePackageDto) {
    return this.procedurePackagesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar pacotes de procedimentos',
    description: 'Filtre por isActive.',
  })
  findAll(@Query() query: ListProcedurePackagesQueryDto) {
    return this.procedurePackagesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar pacote por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.procedurePackagesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar pacote',
    description:
      'Alterar o catalogo nao muda pacotes ja atribuidos a pacientes.',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProcedurePackageDto,
  ) {
    return this.procedurePackagesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover pacote' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.procedurePackagesService.remove(id);
  }
}

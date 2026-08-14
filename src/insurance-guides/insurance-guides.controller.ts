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
import { CreateInsuranceGuideDto } from './dto/create-insurance-guide.dto';
import { ListInsuranceGuidesQueryDto } from './dto/list-insurance-guides-query.dto';
import { UpdateInsuranceGuideDto } from './dto/update-insurance-guide.dto';
import { InsuranceGuidesService } from './insurance-guides.service';

@ApiTags('insurance-guides')
@Controller('insurance-guides')
export class InsuranceGuidesController {
  constructor(
    private readonly insuranceGuidesService: InsuranceGuidesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar guia de plano de saude',
    description:
      'Cria a guia com isBilled=false por padrao. Envie isBilled=true para marcar como faturada na criacao.',
  })
  create(@Body() createInsuranceGuideDto: CreateInsuranceGuideDto) {
    return this.insuranceGuidesService.create(createInsuranceGuideDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar guias de plano de saude',
    description:
      'Por padrao retorna todas as guias. Use isBilled=true ou isBilled=false para filtrar por faturamento.',
  })
  findAll(@Query() query: ListInsuranceGuidesQueryDto) {
    return this.insuranceGuidesService.findAll(query.isBilled);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar guia por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.insuranceGuidesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar guia',
    description: 'Permite marcar ou desmarcar a guia como faturada via isBilled.',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInsuranceGuideDto: UpdateInsuranceGuideDto,
  ) {
    return this.insuranceGuidesService.update(id, updateInsuranceGuideDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover guia' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.insuranceGuidesService.remove(id);
  }
}

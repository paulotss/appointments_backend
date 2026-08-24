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
      'Cria a guia com status=pending e isBilled=false. O faturamento so ocorre via lote (billing-batches). Envie procedures com quantidade autorizada por item.',
  })
  create(@Body() createInsuranceGuideDto: CreateInsuranceGuideDto) {
    return this.insuranceGuidesService.create(createInsuranceGuideDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar guias de plano de saude',
    description:
      'Filtros opcionais: isBilled, availableForBilling, status, patientId, healthProfessionalId, healthPlanId. Paginado com page/limit.',
  })
  findAll(@Query() query: ListInsuranceGuidesQueryDto) {
    return this.insuranceGuidesService.findAll(query);
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
    description:
      'Permite atualizar status e procedimentos (quantidade autorizada por item). isBilled nao e mais gravavel aqui.',
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

import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TissExportService } from '../tiss-export/tiss-export.service';
import { BillingBatchesService } from './billing-batches.service';
import {
  CreateBillingBatchDto,
  ListBillingBatchesQueryDto,
  ReceiveBillingBatchDto,
  UpdateBillingBatchDto,
} from './dto/billing-batch.dto';

@ApiTags('billing-batches')
@Controller('billing-batches')
export class BillingBatchesController {
  constructor(
    private readonly billingBatchesService: BillingBatchesService,
    private readonly tissExportService: TissExportService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar lote de faturamento',
    description:
      'Agrupa guias elegiveis do mesmo plano. O valor e a soma de value * usedQuantity de cada guia.',
  })
  create(@Body() dto: CreateBillingBatchDto) {
    return this.billingBatchesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar lotes de faturamento',
    description:
      'Filtros opcionais: healthPlanId, status. Paginado com page/limit.',
  })
  findAll(@Query() query: ListBillingBatchesQueryDto) {
    return this.billingBatchesService.findAll(query);
  }

  @Get(':id/tiss-xml')
  @ApiOperation({
    summary: 'Exportar XML TISS do lote',
    description:
      'Gera o XML no padrao TISS para lotes abertos, faturados ou quitados. Se houver consulta e SP-SADT, devolve um ZIP.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @Header('Cache-Control', 'no-store')
  async exportTissXml(@Param('id', ParseIntPipe) id: number) {
    const file = await this.tissExportService.exportBatch(id);
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar lote por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billingBatchesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar lote aberto',
    description: 'Inclui ou remove guias apenas enquanto o lote estiver open.',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBillingBatchDto,
  ) {
    return this.billingBatchesService.update(id, dto);
  }

  @Post(':id/bill')
  @ApiOperation({
    summary: 'Faturar lote',
    description:
      'Marca as guias como isBilled e cria a entrada financeira health_plan pendente.',
  })
  @ApiParam({ name: 'id', example: 1 })
  bill(@Param('id', ParseIntPipe) id: number) {
    return this.billingBatchesService.bill(id);
  }

  @Post(':id/receive')
  @ApiOperation({
    summary: 'Registrar recebimento ou glosa do lote',
    description:
      'Se receivedAmount < billedAmount, a entrada fica partially_paid. Items opcionais por guia.',
  })
  @ApiParam({ name: 'id', example: 1 })
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveBillingBatchDto,
  ) {
    return this.billingBatchesService.receive(id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar lote',
    description:
      'Lote open libera as guias. Lote billed so cancela se a entrada ainda estiver pending.',
  })
  @ApiParam({ name: 'id', example: 1 })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.billingBatchesService.cancel(id);
  }
}

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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BillingBatchesService } from '../billing-batches/billing-batches.service';
import type { UploadedFile as UploadedFilePayload } from '../uploads/uploaded-file';
import { CreateInsuranceGuideDto } from './dto/create-insurance-guide.dto';
import { ListInsuranceGuidesQueryDto } from './dto/list-insurance-guides-query.dto';
import { UpdateInsuranceGuideDto } from './dto/update-insurance-guide.dto';
import { InsuranceGuidesService } from './insurance-guides.service';

@ApiTags('insurance-guides')
@Controller('insurance-guides')
export class InsuranceGuidesController {
  constructor(
    private readonly insuranceGuidesService: InsuranceGuidesService,
    private readonly billingBatchesService: BillingBatchesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar guia de plano de saude',
    description:
      'Cria a guia com status=pending e isBilled=false. O faturamento ocorre via lote (billing-batches) ou pela guia individual (POST /insurance-guides/:id/bill). Envie procedures com quantidade autorizada por item. authorizationDate, expirationDate e guideNumber sao opcionais: a autorizacao default e hoje e a validade default e autorizacao + prazo do plano.',
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

  @Post(':id/bill')
  @ApiOperation({
    summary: 'Faturar guia individualmente',
    description:
      'Cria um lote com esta unica guia, marca isBilled=true e gera a entrada financeira health_plan pendente. A guia precisa estar elegivel (nao faturada, fora de lote e com usedQuantity > 0).',
  })
  @ApiParam({ name: 'id', example: 1 })
  bill(@Param('id', ParseIntPipe) id: number) {
    return this.billingBatchesService.billGuide(id);
  }

  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Enviar imagem ou PDF da guia' })
  @ApiParam({ name: 'id', example: 1 })
  addDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFilePayload,
  ) {
    return this.insuranceGuidesService.addDocument(id, file);
  }

  @Get(':id/documents/:documentId/download')
  @ApiOperation({ summary: 'Baixar documento da guia' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'documentId', example: 1 })
  async downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    const { document, stream } = await this.insuranceGuidesService.openDocument(
      id,
      documentId,
    );
    return new StreamableFile(stream, {
      type: document.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(document.originalName)}"`,
    });
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Remover documento da guia' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'documentId', example: 1 })
  removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.insuranceGuidesService.removeDocument(id, documentId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar guia',
    description:
      'Permite atualizar status, numero da guia, data de autorizacao, validade e procedimentos (quantidade autorizada por item). isBilled nao e mais gravavel aqui.',
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

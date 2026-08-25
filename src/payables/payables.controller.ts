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
import {
  CreatePayableDto,
  ListPayablesQueryDto,
  PayPayableDto,
  UpdatePayableDto,
} from './dto/payable.dto';
import { PayablesService } from './payables.service';
import type { UploadedFile as UploadedFilePayload } from '../uploads/uploaded-file';

@ApiTags('payables')
@Controller('payables')
export class PayablesController {
  constructor(private readonly payablesService: PayablesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar conta a pagar' })
  create(@Body() dto: CreatePayableDto) {
    return this.payablesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar contas a pagar',
    description: 'Filtros: status, supplierId. Paginado com page/limit.',
  })
  findAll(@Query() query: ListPayablesQueryDto) {
    return this.payablesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar conta a pagar por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.payablesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar conta a pagar pendente' })
  @ApiParam({ name: 'id', example: 1 })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePayableDto) {
    return this.payablesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover conta a pagar pendente' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.payablesService.remove(id);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Pagar conta a pagar',
    description: 'Marca a conta como paga e gera a saida financeira.',
  })
  @ApiParam({ name: 'id', example: 1 })
  pay(@Param('id', ParseIntPipe) id: number, @Body() dto: PayPayableDto) {
    return this.payablesService.pay(id, dto);
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
  @ApiOperation({ summary: 'Enviar documento da nota ou boleto' })
  @ApiParam({ name: 'id', example: 1 })
  addDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFilePayload,
  ) {
    return this.payablesService.addDocument(id, file);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Listar documentos da conta a pagar' })
  @ApiParam({ name: 'id', example: 1 })
  listDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.payablesService.listDocuments(id);
  }

  @Get(':id/documents/:documentId/download')
  @ApiOperation({ summary: 'Baixar documento da conta a pagar' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'documentId', example: 1 })
  async downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    const { document, stream } = await this.payablesService.openDocument(
      id,
      documentId,
    );
    return new StreamableFile(stream, {
      type: document.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(document.originalName)}"`,
    });
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Remover documento de conta pendente' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'documentId', example: 1 })
  removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.payablesService.removeDocument(id, documentId);
  }
}

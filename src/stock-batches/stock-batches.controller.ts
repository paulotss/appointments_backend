import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { StockBatchResponseDto } from './dto/stock-batch-response.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { StockBatchListStatus } from './stock-batch-list-status.enum';
import { StockBatchesService } from './stock-batches.service';

@ApiTags('stock-batches')
@Controller('stock-batches')
export class StockBatchesController {
  constructor(private readonly stockBatchesService: StockBatchesService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar lote de estoque (entrada)',
    description:
      'Cria um lote com isClosed=false por padrao. Se currentQuantity for 0, o lote e fechado automaticamente.',
  })
  create(@Body() createStockBatchDto: CreateStockBatchDto) {
    return this.stockBatchesService.create(createStockBatchDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar lotes de estoque',
    description:
      'Por padrao retorna lotes abertos. Use status=closed para lotes fechados ou status=all para todos.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: StockBatchListStatus,
    description:
      'Filtrar lotes por status: open (padrao), closed ou all',
  })
  @ApiOkResponse({ type: StockBatchResponseDto, isArray: true })
  findAll(
    @Query(
      'status',
      new ParseEnumPipe(StockBatchListStatus, { optional: true }),
    )
    status?: StockBatchListStatus,
  ) {
    return this.stockBatchesService.findAll(
      status ?? StockBatchListStatus.Open,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar lote de estoque por id' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: StockBatchResponseDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockBatchesService.findOne(id);
  }

  @Patch(':id/close')
  @ApiOperation({
    summary: 'Fechar lote de estoque',
    description: 'Define isClosed=true para o lote informado.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: StockBatchResponseDto })
  close(@Param('id', ParseIntPipe) id: number) {
    return this.stockBatchesService.close(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar lote de estoque',
    description:
      'Ao atualizar currentQuantity para 0, isClosed e definido automaticamente como true.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: StockBatchResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStockBatchDto: UpdateStockBatchDto,
  ) {
    return this.stockBatchesService.update(id, updateStockBatchDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover lote de estoque' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockBatchesService.remove(id);
  }
}

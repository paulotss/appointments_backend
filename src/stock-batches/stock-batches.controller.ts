import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { StockBatchesService } from './stock-batches.service';

@ApiTags('stock-batches')
@Controller('stock-batches')
export class StockBatchesController {
  constructor(private readonly stockBatchesService: StockBatchesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar lote de estoque (entrada)' })
  create(@Body() createStockBatchDto: CreateStockBatchDto) {
    return this.stockBatchesService.create(createStockBatchDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar lotes de estoque' })
  findAll() {
    return this.stockBatchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar lote de estoque por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockBatchesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar lote de estoque' })
  @ApiParam({ name: 'id', example: 1 })
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

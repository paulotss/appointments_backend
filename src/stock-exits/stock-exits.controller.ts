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
import { CreateStockExitDto } from './dto/create-stock-exit.dto';
import { UpdateStockExitDto } from './dto/update-stock-exit.dto';
import { StockExitsService } from './stock-exits.service';

@ApiTags('stock-exits')
@Controller('stock-exits')
export class StockExitsController {
  constructor(private readonly stockExitsService: StockExitsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar saida de estoque' })
  create(@Body() createStockExitDto: CreateStockExitDto) {
    return this.stockExitsService.create(createStockExitDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar saidas de estoque' })
  findAll() {
    return this.stockExitsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar saida de estoque por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stockExitsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar saida de estoque' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStockExitDto: UpdateStockExitDto,
  ) {
    return this.stockExitsService.update(id, updateStockExitDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover saida de estoque' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stockExitsService.remove(id);
  }
}

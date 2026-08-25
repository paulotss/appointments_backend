import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ListFinancialExitsQueryDto } from './dto/list-financial-exits-query.dto';
import { FinancialExitsService } from './financial-exits.service';

@ApiTags('financial-exits')
@Controller('financial-exits')
export class FinancialExitsController {
  constructor(private readonly financialExitsService: FinancialExitsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar saidas financeiras',
    description:
      'Filtros: supplierId, from, to, paymentMethod. Paginado com page/limit. counts traz amount do filtro.',
  })
  findAll(@Query() query: ListFinancialExitsQueryDto) {
    return this.financialExitsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar saida financeira por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financialExitsService.findOne(id);
  }
}

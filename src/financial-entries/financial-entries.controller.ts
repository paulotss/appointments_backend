import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CreatePrivateFinancialEntryDto,
  ListFinancialEntriesQueryDto,
} from './dto/financial-entry.dto';
import { FinancialEntriesService } from './financial-entries.service';

@ApiTags('financial-entries')
@Controller('financial-entries')
export class FinancialEntriesController {
  constructor(
    private readonly financialEntriesService: FinancialEntriesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar pagamento de procedimento particular',
    description:
      'Gera a entrada ja paga a partir de um agendamento particular finished. discountAmount e surchargeAmount sao opcionais. O valor liquido e calculado no servidor.',
  })
  create(@Body() dto: CreatePrivateFinancialEntryDto) {
    return this.financialEntriesService.createPrivateEntry(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar entradas financeiras',
    description:
      'Filtros: type, status, from, to. Paginado com page/limit. counts traz amount e receivedAmount do filtro.',
  })
  findAll(@Query() query: ListFinancialEntriesQueryDto) {
    return this.financialEntriesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar entrada financeira por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financialEntriesService.findOne(id);
  }
}

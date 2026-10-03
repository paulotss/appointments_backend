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
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';

import {
  CreatePrivateFinancialEntryDto,
  ListFinancialEntriesQueryDto,
  ReceiveBenefitInstallmentDto,
} from './dto/financial-entry.dto';
import { FinancialEntriesService } from './financial-entries.service';

@ApiTags('financial-entries')
@Roles(...STAFF_ROLES)
@Controller('financial-entries')
export class FinancialEntriesController {
  constructor(
    private readonly financialEntriesService: FinancialEntriesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar pagamento de procedimento particular',
    description:
      'Gera a entrada ja paga a partir dos procedimentos avulsos de um agendamento particular ou misto finished. Itens de pacote nao sao cobrados. discountAmount e surchargeAmount sao opcionais.',
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

  @Post(':id/receive')
  @ApiOperation({
    summary: 'Receber parcela pendente do cartão',
    description: 'Marca a parcela como paga pelo valor integral.',
  })
  @ApiParam({ name: 'id', example: 1 })
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveBenefitInstallmentDto,
  ) {
    return this.financialEntriesService.receiveBenefitInstallment(id, dto);
  }
}

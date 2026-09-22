import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentDataService } from './agent-data.service';
import {
  ListBillingBatchesAgentQueryDto,
  ListCallCenterAppointmentsAgentQueryDto,
  ListCallsAgentQueryDto,
  ListCatalogAgentQueryDto,
  ListClinicalAppointmentsAgentQueryDto,
  ListFinancialEntriesAgentQueryDto,
  ListFinancialExitsAgentQueryDto,
  ListInsuranceGuidesAgentQueryDto,
  ListMessagesAgentQueryDto,
  ListPayablesAgentQueryDto,
  ListProceduresAgentQueryDto,
  ListProductsAgentQueryDto,
  ListStockBatchesAgentQueryDto,
  ListStockExitsAgentQueryDto,
  SearchQueryDto,
} from './dto/agent-data-query.dto';

@ApiTags('agent-data')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('agent-data')
export class AgentDataController {
  constructor(private readonly agentDataService: AgentDataService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Snapshot compacto da clinica para agentes' })
  getOverview() {
    return this.agentDataService.getOverview();
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Cadastros de referencia (lista pequena)' })
  listCatalog(@Query() query: ListCatalogAgentQueryDto) {
    return this.agentDataService.listCatalog(query.type);
  }

  @Get('patients')
  @ApiOperation({ summary: 'Buscar pacientes (nome, CPF, telefone)' })
  searchPatients(@Query() query: SearchQueryDto) {
    return this.agentDataService.searchPatients(query);
  }

  @Get('patients/:id')
  @ApiOperation({ summary: 'Detalhe compacto do paciente' })
  @ApiParam({ name: 'id', example: 1 })
  getPatient(@Param('id', ParseIntPipe) id: number) {
    return this.agentDataService.getPatient(id);
  }

  @Get('health-professionals')
  @ApiOperation({ summary: 'Buscar profissionais' })
  searchProfessionals(@Query() query: SearchQueryDto) {
    return this.agentDataService.searchProfessionals(query);
  }

  @Get('health-professionals/:id')
  @ApiOperation({ summary: 'Detalhe compacto do profissional' })
  @ApiParam({ name: 'id', example: 1 })
  getProfessional(@Param('id', ParseIntPipe) id: number) {
    return this.agentDataService.getProfessional(id);
  }

  @Get('clinical-appointments')
  @ApiOperation({ summary: 'Agenda clinica compacta (from/to obrigatorios)' })
  listClinicalAppointments(
    @Query() query: ListClinicalAppointmentsAgentQueryDto,
  ) {
    return this.agentDataService.listClinicalAppointments(query);
  }

  @Get('clinical-appointments/:id')
  @ApiOperation({ summary: 'Detalhe compacto de agendamento clinico' })
  @ApiParam({ name: 'id', example: 1 })
  getClinicalAppointment(@Param('id', ParseIntPipe) id: number) {
    return this.agentDataService.getClinicalAppointment(id);
  }

  @Get('insurance-guides')
  @ApiOperation({
    summary: 'Buscar guias (sem documentos nem precos aninhados)',
  })
  searchInsuranceGuides(@Query() query: ListInsuranceGuidesAgentQueryDto) {
    return this.agentDataService.searchInsuranceGuides(query);
  }

  @Get('insurance-guides/:id')
  @ApiOperation({ summary: 'Detalhe compacto da guia' })
  @ApiParam({ name: 'id', example: 1 })
  getInsuranceGuide(@Param('id', ParseIntPipe) id: number) {
    return this.agentDataService.getInsuranceGuide(id);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Agendamentos do call center' })
  listCallCenterAppointments(
    @Query() query: ListCallCenterAppointmentsAgentQueryDto,
  ) {
    return this.agentDataService.listCallCenterAppointments(query);
  }

  @Get('calls')
  @ApiOperation({ summary: 'Ligacoes compactas' })
  listCalls(@Query() query: ListCallsAgentQueryDto) {
    return this.agentDataService.listCalls(query);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Mensagens sem content' })
  listMessages(@Query() query: ListMessagesAgentQueryDto) {
    return this.agentDataService.listMessages(query);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Detalhe da mensagem (inclui content)' })
  @ApiParam({ name: 'id', example: 1 })
  getMessage(@Param('id', ParseIntPipe) id: number) {
    return this.agentDataService.getMessage(id);
  }

  @Get('financial-entries')
  @ApiOperation({ summary: 'Entradas financeiras compactas' })
  listFinancialEntries(@Query() query: ListFinancialEntriesAgentQueryDto) {
    return this.agentDataService.listFinancialEntries(query);
  }

  @Get('payables')
  @ApiOperation({ summary: 'Contas a pagar compactas' })
  listPayables(@Query() query: ListPayablesAgentQueryDto) {
    return this.agentDataService.listPayables(query);
  }

  @Get('financial-exits')
  @ApiOperation({ summary: 'Saidas financeiras compactas' })
  listFinancialExits(@Query() query: ListFinancialExitsAgentQueryDto) {
    return this.agentDataService.listFinancialExits(query);
  }

  @Get('billing-batches')
  @ApiOperation({ summary: 'Lotes de faturamento sem guias aninhadas' })
  listBillingBatches(@Query() query: ListBillingBatchesAgentQueryDto) {
    return this.agentDataService.listBillingBatches(query);
  }

  @Get('billing-batches/:id')
  @ApiOperation({ summary: 'Detalhe compacto do lote' })
  @ApiParam({ name: 'id', example: 1 })
  getBillingBatch(@Param('id', ParseIntPipe) id: number) {
    return this.agentDataService.getBillingBatch(id);
  }

  @Get('products')
  @ApiOperation({ summary: 'Buscar produtos' })
  searchProducts(@Query() query: ListProductsAgentQueryDto) {
    return this.agentDataService.searchProducts(query);
  }

  @Get('stock-summary')
  @ApiOperation({ summary: 'Consolidacao de estoque sem lotes embutidos' })
  getStockSummary(@Query() query: ListProductsAgentQueryDto) {
    return this.agentDataService.getStockSummary(query);
  }

  @Get('stock-batches')
  @ApiOperation({ summary: 'Lotes de estoque compactos' })
  listStockBatches(@Query() query: ListStockBatchesAgentQueryDto) {
    return this.agentDataService.listStockBatches(query);
  }

  @Get('stock-exits')
  @ApiOperation({ summary: 'Saidas de estoque compactas' })
  listStockExits(@Query() query: ListStockExitsAgentQueryDto) {
    return this.agentDataService.listStockExits(query);
  }

  @Get('procedures')
  @ApiOperation({ summary: 'Buscar procedimentos sem precos por plano' })
  searchProcedures(@Query() query: ListProceduresAgentQueryDto) {
    return this.agentDataService.searchProcedures(query);
  }
}

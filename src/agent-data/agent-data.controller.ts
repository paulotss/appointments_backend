import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceTokenScope } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { STAFF_ROLES } from '../auth/roles';
import { ClinicalAppointmentsService } from '../clinical-appointments/clinical-appointments.service';
import { AgentCreateClinicalAppointmentDto } from '../clinical-appointments/dto/agent-create-clinical-appointment.dto';
import { ScheduleRulesService } from '../schedule-rules/schedule-rules.service';

import { AgentDataService } from './agent-data.service';
import {
  AvailableSlotsAgentQueryDto,
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
  ListProcedurePackagesAgentQueryDto,
  ListProceduresAgentQueryDto,
  ListProductsAgentQueryDto,
  ListStockBatchesAgentQueryDto,
  ListStockExitsAgentQueryDto,
  PatientScopeAgentQueryDto,
  SearchQueryDto,
} from './dto/agent-data-query.dto';

@ApiTags('agent-data')
@ApiBearerAuth('JWT')
@Roles(...STAFF_ROLES)
@ServiceScopes(ServiceTokenScope.AGENT_DATA_READ)
@Controller('agent-data')
export class AgentDataController {
  constructor(
    private readonly agentDataService: AgentDataService,
    private readonly scheduleRulesService: ScheduleRulesService,
    private readonly clinicalAppointmentsService: ClinicalAppointmentsService,
  ) {}

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
  @ApiOperation({
    summary: 'Buscar pacientes por nome, CPF ou telefone, sem devolver esses dados',
  })
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

  @Get('procedure-packages')
  @ApiOperation({ summary: 'Catalogo de pacotes de procedimentos' })
  listProcedurePackages(@Query() query: ListProcedurePackagesAgentQueryDto) {
    return this.agentDataService.listProcedurePackages(query);
  }

  @Get('patient-packages')
  @ApiOperation({
    summary: 'Pacotes de um paciente, com saldo restante',
  })
  listPatientPackages(@Query() query: PatientScopeAgentQueryDto) {
    return this.agentDataService.listPatientPackages(query);
  }

  @Get('benefit-subscriptions')
  @ApiOperation({
    summary: 'Cartao de beneficios de um paciente, com cotas restantes',
  })
  listBenefitSubscriptions(@Query() query: PatientScopeAgentQueryDto) {
    return this.agentDataService.listBenefitSubscriptions(query);
  }

  @Get('health-professionals/:id/schedule-rules')
  @ApiOperation({ summary: 'Regras de atendimento do profissional' })
  @ApiParam({ name: 'id', example: 1 })
  listScheduleRules(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleRulesService.listForProfessional(id);
  }

  @Get('health-professionals/:id/available-slots')
  @ApiOperation({
    summary: 'Horarios livres de um procedimento na ficha do profissional',
  })
  @ApiParam({ name: 'id', example: 1 })
  listAvailableSlots(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AvailableSlotsAgentQueryDto,
  ) {
    return this.scheduleRulesService.availableSlots({
      healthProfessionalId: id,
      procedureId: query.procedureId,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
    });
  }

  @Post('clinical-appointments')
  @ServiceScopes(ServiceTokenScope.AGENT_DATA_WRITE)
  @ApiOperation({
    summary: 'Criar agendamento clinico respeitando as regras do profissional',
    description:
      'Recusa com 409 quando o horario foge da ficha. endsAt pode ser omitido: a duracao sai da regra.',
  })
  createClinicalAppointment(
    @Body() dto: AgentCreateClinicalAppointmentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.clinicalAppointmentsService.createForAgent(dto, user);
  }
}

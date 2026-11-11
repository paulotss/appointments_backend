import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceTokenScope } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceScopes } from '../auth/decorators/service-scopes.decorator';
import type { AuthPrincipal } from '../auth/interfaces/jwt-payload.interface';
import { STAFF_ROLES } from '../auth/roles';
import { ConfirmationAdminService } from './confirmation-admin.service';
import {
  ResponseDeadlineDto,
  ResolveCampaignPendingDto,
  AssociateSubjectDto,
  CreateCampaignDto,
  InformVerificationDto,
  PatientRefQueryDto,
  RecordAuthorizationDto,
  SearchPatientsDto,
  ReplaceCampaignItemsDto,
  VerifyVerificationDto,
} from './dto/confirmation-admin.dto';

const strictBody = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@ApiTags('confirmation-campaigns')
@ApiBearerAuth('JWT')
@Roles(...STAFF_ROLES)
@UsePipes(strictBody)
@Controller('confirmation-campaigns')
export class ConfirmationCampaignsController {
  constructor(private readonly admin: ConfirmationAdminService) {}

  @Post()
  @ApiOperation({ summary: 'Abrir campanha administrativa, sem disparo' })
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateCampaignDto) {
    return this.admin.createCampaign(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar campanhas de confirmação' })
  list() {
    return this.admin.listCampaigns();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar campanha, itens e histórico' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getCampaign(id);
  }

  @Put(':id/items')
  @ApiOperation({
    summary: 'Substituir itens enquanto a campanha não está aprovada',
  })
  replace(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceCampaignItemsDto,
  ) {
    return this.admin.replaceItems(user, id, dto);
  }

  @Post(':id/resolve-pending')
  @ApiOperation({ summary: 'Atualizar e reavaliar pendências, sem criar verificações ou enviar mensagens' })
  resolvePending(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveCampaignPendingDto,
  ) {
    return this.admin.resolveCampaignPending(user, id, dto.itemId);
  }

  @Put(':id/response-deadline')
  deadline(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponseDeadlineDto,
  ) {
    return this.admin.setResponseDeadline(user, id, dto.responseDeadlineAt);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Enviar a campanha para revisão administrativa' })
  review(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.submitReview(user, id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Aprovar a campanha sem autorizar destinatários e sem enviar',
  })
  approve(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.approve(user, id);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Devolver a campanha aprovada para revisão' })
  reopen(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.reopen(user, id);
  }
}

@ApiTags('contact-registry')
@ApiBearerAuth('JWT')
@Roles(...STAFF_ROLES)
@UsePipes(strictBody)
@Controller('contact-registry')
export class ContactRegistryController {
  constructor(private readonly admin: ConfirmationAdminService) {}

  @Post('patient-search')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Pesquisar pacientes da agenda pelo nome, sem telefone completo e sem vínculo automático',
  })
  searchPatients(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: SearchPatientsDto,
  ) {
    return this.admin.searchPatients(user, dto.name);
  }

  @Post('reclassify')
  @ApiOperation({ summary: 'Reavaliar o contato nas campanhas sem enviar mensagens' })
  reclassifyContact(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: PatientRefQueryDto,
  ) {
    return this.admin.reclassifyContact(user, dto.patientRef);
  }

  @Post('verifications')
  @ApiOperation({
    summary: 'Registrar contato informado, sem comprovar titularidade',
  })
  inform(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: InformVerificationDto,
  ) {
    return this.admin.informVerification(user, dto);
  }

  @Get('verifications')
  @ApiOperation({ summary: 'Listar verificações de um paciente opaco' })
  listVerifications(@Query() query: PatientRefQueryDto) {
    return this.admin.listVerifications(query.patientRef);
  }

  @Post('verifications/:id/verify')
  @ApiOperation({
    summary:
      'Registrar o procedimento de verificação da referência já informada',
  })
  verify(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: VerifyVerificationDto,
  ) {
    return this.admin.verifyContact(user, id, dto);
  }

  @Post('verifications/:id/revoke')
  @ApiOperation({ summary: 'Revogar verificação sem apagar o histórico' })
  revokeVerification(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.admin.revokeVerification(user, id);
  }

  @Post('authorizations')
  @ApiOperation({
    summary: 'Registrar autorização de contato, sem presumir titularidade',
  })
  authorize(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: RecordAuthorizationDto,
  ) {
    return this.admin.recordAuthorization(user, dto);
  }

  @Get('authorizations')
  @ApiOperation({ summary: 'Listar autorizações de um paciente opaco' })
  listAuthorizations(@Query() query: PatientRefQueryDto) {
    return this.admin.listAuthorizations(query.patientRef);
  }

  @Post('authorizations/:id/revoke')
  @ApiOperation({ summary: 'Revogar autorização sem apagar o histórico' })
  revokeAuthorization(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ) {
    return this.admin.revokeAuthorization(user, id);
  }

  @Post('associations')
  @ApiOperation({
    summary:
      'Associar referência opaca a um paciente do Higia, sem busca por telefone',
  })
  associate(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: AssociateSubjectDto,
  ) {
    return this.admin.associateSubject(user, dto);
  }

  @Get('associations')
  @ApiOperation({ summary: 'Consultar associação explícita de uma referência' })
  listAssociations(@Query() query: PatientRefQueryDto) {
    return this.admin.listAssociations(query.patientRef);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Histórico administrativo de um paciente opaco' })
  audit(@Query() query: PatientRefQueryDto) {
    return this.admin.listAudit(query.patientRef);
  }
}

@ApiTags('clinic-registry')
@ApiBearerAuth('JWT')
@Roles(...STAFF_ROLES)
@ServiceScopes(ServiceTokenScope.CLINIC_REGISTRY_READ)
@Controller('clinic-registry')
export class ClinicRegistryReadController {
  constructor(private readonly admin: ConfirmationAdminService) {}

  @Get('contacts')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Leitura do registro para o resolvedor. Não grava e não envia.',
  })
  contacts(@Query() query: PatientRefQueryDto) {
    return this.admin.readForResolver(query.patientRef);
  }
}

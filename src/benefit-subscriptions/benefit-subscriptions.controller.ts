import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_STAFF_ROLES, STAFF_ROLES } from '../auth/roles';

import { BenefitSubscriptionsService } from './benefit-subscriptions.service';
import { AddBenefitDependentDto } from './dto/add-benefit-dependent.dto';
import { CreateBenefitNoteDto } from './dto/create-benefit-note.dto';
import { CreateBenefitSubscriptionDto } from './dto/create-benefit-subscription.dto';
import { ListBenefitSubscriptionsQueryDto } from './dto/list-benefit-subscriptions-query.dto';

@ApiTags('benefit-subscriptions')
@Roles(...STAFF_ROLES)
@Controller('benefit-subscriptions')
export class BenefitSubscriptionsController {
  constructor(
    private readonly benefitSubscriptionsService: BenefitSubscriptionsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Aderir um paciente a um plano do cartão',
    description:
      'Gera parcelas pendentes. A primeira soma adesão e taxa por dependente. O saldo dos benefícios é um snapshot do catálogo.',
  })
  create(@Body() dto: CreateBenefitSubscriptionDto) {
    return this.benefitSubscriptionsService.create(dto);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Get()
  @ApiOperation({
    summary: 'Listar adesões de um paciente',
    description:
      'Inclui adesões em que o paciente é titular ou dependente. remainingQuantity desconta reservas.',
  })
  findAll(@Query() query: ListBenefitSubscriptionsQueryDto) {
    return this.benefitSubscriptionsService.findAll(query);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Get(':id')
  @ApiOperation({ summary: 'Buscar adesão por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListBenefitSubscriptionsQueryDto,
  ) {
    return this.benefitSubscriptionsService.findOne(
      id,
      query.excludeAppointmentId,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar adesão',
    description: 'Cancela parcelas pendentes e preserva as pagas.',
  })
  @ApiParam({ name: 'id', example: 1 })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.benefitSubscriptionsService.cancel(id);
  }

  @Post(':id/dependents')
  @ApiOperation({
    summary: 'Incluir dependente',
    description: 'Não recalcula parcelas já geradas.',
  })
  @ApiParam({ name: 'id', example: 1 })
  addDependent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddBenefitDependentDto,
  ) {
    return this.benefitSubscriptionsService.addDependent(id, dto);
  }

  @Delete(':id/dependents/:patientId')
  @ApiOperation({ summary: 'Remover dependente' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'patientId', example: 4 })
  removeDependent(
    @Param('id', ParseIntPipe) id: number,
    @Param('patientId', ParseIntPipe) patientId: number,
  ) {
    return this.benefitSubscriptionsService.removeDependent(id, patientId);
  }

  @Post(':id/entitlements/:entitlementId/notes')
  @ApiOperation({ summary: 'Anotar uso de um benefício da adesão' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'entitlementId', example: 3 })
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Param('entitlementId', ParseIntPipe) entitlementId: number,
    @Body() dto: CreateBenefitNoteDto,
  ) {
    return this.benefitSubscriptionsService.addNote(id, entitlementId, dto);
  }
}

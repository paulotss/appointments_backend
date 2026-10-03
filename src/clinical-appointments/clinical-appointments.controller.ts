import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AGENDA_ROLES, CLINICAL_STAFF_ROLES } from '../auth/roles';
import { ClinicalAppointmentsService } from './clinical-appointments.service';
import { CreateClinicalAppointmentDto } from './dto/create-clinical-appointment.dto';
import { ListClinicalAppointmentsQueryDto } from './dto/list-clinical-appointments-query.dto';
import { UpdateClinicalAppointmentDto } from './dto/update-clinical-appointment.dto';

@ApiTags('clinical-appointments')
@Roles(...CLINICAL_STAFF_ROLES)
@Controller('clinical-appointments')
export class ClinicalAppointmentsController {
  constructor(
    private readonly clinicalAppointmentsService: ClinicalAppointmentsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar agendamento clinico',
    description:
      'Aceita avulsos (procedureIds), itens de pacote (patientPackageItemIds), cotas do cartão (benefitUses) e/ou guias (insuranceGuideIds). O tipo e derivado das origens.',
  })
  create(
    @Body() createDto: CreateClinicalAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalAppointmentsService.create(createDto, user);
  }

  @Get()
  @Roles(...AGENDA_ROLES)
  @ApiOperation({
    summary: 'Listar agendamentos clinicos',
    description:
      'Filtros opcionais: patientId, healthProfessionalId, status, type, insuranceGuideId, from, to (YYYY-MM-DD). Paciente e profissional têm o escopo forçado pelo token.',
  })
  findAll(
    @Query() query: ListClinicalAppointmentsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalAppointmentsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(...AGENDA_ROLES)
  @ApiOperation({ summary: 'Buscar agendamento clinico por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalAppointmentsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar agendamento clinico',
    description:
      'Ao entrar em finished, incrementa usedQuantity das guias e dos itens de pacote. Ao sair, decrementa.',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateClinicalAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalAppointmentsService.update(id, updateDto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover agendamento clinico' })
  @ApiParam({ name: 'id', example: 1 })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalAppointmentsService.remove(id, user);
  }
}

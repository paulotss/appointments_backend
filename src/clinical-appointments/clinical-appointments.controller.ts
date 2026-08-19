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
import { ClinicalAppointmentsService } from './clinical-appointments.service';
import { CreateClinicalAppointmentDto } from './dto/create-clinical-appointment.dto';
import { ListClinicalAppointmentsQueryDto } from './dto/list-clinical-appointments-query.dto';
import { UpdateClinicalAppointmentDto } from './dto/update-clinical-appointment.dto';

@ApiTags('clinical-appointments')
@Controller('clinical-appointments')
export class ClinicalAppointmentsController {
  constructor(
    private readonly clinicalAppointmentsService: ClinicalAppointmentsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar agendamento clinico',
    description:
      'Particular exige procedureIds. Plano de saude exige insuranceGuideIds e copia os procedimentos das guias.',
  })
  create(@Body() createDto: CreateClinicalAppointmentDto) {
    return this.clinicalAppointmentsService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar agendamentos clinicos',
    description:
      'Filtros opcionais: patientId, healthProfessionalId, status, type, insuranceGuideId, from, to (YYYY-MM-DD).',
  })
  findAll(@Query() query: ListClinicalAppointmentsQueryDto) {
    return this.clinicalAppointmentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar agendamento clinico por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clinicalAppointmentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar agendamento clinico',
    description:
      'Ao entrar em finished (plano), incrementa usedQuantity de cada procedimento de cada guia associada. Ao sair, decrementa.',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateClinicalAppointmentDto,
  ) {
    return this.clinicalAppointmentsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover agendamento clinico' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clinicalAppointmentsService.remove(id);
  }
}

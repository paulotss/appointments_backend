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
import { CLINICAL_STAFF_ROLES, STAFF_ROLES } from '../auth/roles';

import { CreatePatientPackageDto } from './dto/create-patient-package.dto';
import { ListPatientPackagesQueryDto } from './dto/list-patient-packages-query.dto';
import { PatientPackagesService } from './patient-packages.service';

@ApiTags('patient-packages')
@Roles(...STAFF_ROLES)
@Controller('patient-packages')
export class PatientPackagesController {
  constructor(private readonly patientPackagesService: PatientPackagesService) {}

  @Post()
  @ApiOperation({
    summary: 'Atribuir pacote a um paciente',
    description:
      'Cobra o pacote inteiro (entrada financeira paga) e congela quantidade e valor com desconto.',
  })
  create(@Body() dto: CreatePatientPackageDto) {
    return this.patientPackagesService.create(dto);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Get()
  @ApiOperation({
    summary: 'Listar pacotes atribuidos a um paciente',
    description:
      'Obrigatorio patientId. remainingQuantity desconta reservas de agendamentos nao finalizados.',
  })
  findAll(@Query() query: ListPatientPackagesQueryDto) {
    return this.patientPackagesService.findAll(query);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Get(':id')
  @ApiOperation({ summary: 'Buscar pacote atribuido por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListPatientPackagesQueryDto,
  ) {
    return this.patientPackagesService.findOne(id, query.excludeAppointmentId);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar pacote atribuido',
    description:
      'Somente se nenhuma quantidade foi usada. Nao estorna o pagamento.',
  })
  @ApiParam({ name: 'id', example: 1 })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.patientPackagesService.cancel(id);
  }
}

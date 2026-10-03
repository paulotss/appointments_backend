import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PROFESSIONAL_ROLES } from '../auth/roles';
import { ClinicalRecordsService } from './clinical-records.service';
import { CreateClinicalEvolutionDto } from './dto/create-clinical-evolution.dto';
import { UpdateClinicalEvolutionDto } from './dto/update-clinical-evolution.dto';
import { UpsertClinicalChartDto } from './dto/upsert-clinical-chart.dto';

@ApiTags('clinical-records')
@Roles(...PROFESSIONAL_ROLES)
@Controller('patients/:patientId')
export class ClinicalRecordsController {
  constructor(
    private readonly clinicalRecordsService: ClinicalRecordsService,
  ) {}

  @Get('clinical-chart')
  @ApiOperation({ summary: 'Buscar ficha clínica do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  getChart(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.clinicalRecordsService.getChart(patientId);
  }

  @Put('clinical-chart')
  @ApiOperation({ summary: 'Gravar ficha clínica do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  upsertChart(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: UpsertClinicalChartDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalRecordsService.upsertChart(patientId, dto, user);
  }

  @Get('clinical-evolutions')
  @ApiOperation({ summary: 'Listar evoluções SOAP do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  listEvolutions(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.clinicalRecordsService.listEvolutions(patientId);
  }

  @Post('clinical-evolutions')
  @ApiOperation({ summary: 'Registrar evolução SOAP' })
  @ApiParam({ name: 'patientId', example: 1 })
  createEvolution(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreateClinicalEvolutionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalRecordsService.createEvolution(patientId, dto, user);
  }

  @Patch('clinical-evolutions/:evolutionId')
  @ApiOperation({ summary: 'Corrigir evolução SOAP do próprio autor' })
  @ApiParam({ name: 'patientId', example: 1 })
  @ApiParam({ name: 'evolutionId', example: 1 })
  updateEvolution(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('evolutionId', ParseIntPipe) evolutionId: number,
    @Body() dto: UpdateClinicalEvolutionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clinicalRecordsService.updateEvolution(
      patientId,
      evolutionId,
      dto,
      user,
    );
  }
}

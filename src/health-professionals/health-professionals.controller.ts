import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateHealthProfessionalDto } from './dto/create-health-professional.dto';
import { ListHealthProfessionalsQueryDto } from './dto/list-health-professionals-query.dto';
import { ReplaceScheduleExceptionsDto } from './dto/replace-schedule-exceptions.dto';
import { ScheduleRangeQueryDto } from './dto/schedule-range-query.dto';
import { UpdateHealthProfessionalDto } from './dto/update-health-professional.dto';
import { HealthProfessionalsService } from './health-professionals.service';

@ApiTags('health-professionals')
@Controller('health-professionals')
export class HealthProfessionalsController {
  constructor(
    private readonly healthProfessionalsService: HealthProfessionalsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar profissional da saude' })
  create(@Body() createHealthProfessionalDto: CreateHealthProfessionalDto) {
    return this.healthProfessionalsService.create(createHealthProfessionalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar profissionais da saude' })
  findAll(@Query() query: ListHealthProfessionalsQueryDto) {
    return this.healthProfessionalsService.findAll(query);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Bloqueios efetivos do profissional no periodo' })
  @ApiParam({ name: 'id', example: 1 })
  findSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ScheduleRangeQueryDto,
  ) {
    return this.healthProfessionalsService.findSchedule(id, query);
  }

  @Put(':id/schedule-exceptions')
  @ApiOperation({ summary: 'Substituir excecoes de bloqueio de uma data' })
  @ApiParam({ name: 'id', example: 1 })
  replaceExceptions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceScheduleExceptionsDto,
  ) {
    return this.healthProfessionalsService.replaceExceptions(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar profissional da saude por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.healthProfessionalsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar profissional da saude' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHealthProfessionalDto: UpdateHealthProfessionalDto,
  ) {
    return this.healthProfessionalsService.update(
      id,
      updateHealthProfessionalDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover profissional da saude' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.healthProfessionalsService.remove(id);
  }
}

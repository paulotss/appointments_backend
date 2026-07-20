import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateHealthProfessionalDto } from './dto/create-health-professional.dto';
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
  findAll() {
    return this.healthProfessionalsService.findAll();
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

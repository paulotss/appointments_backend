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
import { CreateHealthPlanDto } from './dto/create-health-plan.dto';
import { UpdateHealthPlanDto } from './dto/update-health-plan.dto';
import { HealthPlansService } from './health-plans.service';

@ApiTags('health-plans')
@Controller('health-plans')
export class HealthPlansController {
  constructor(private readonly healthPlansService: HealthPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Criar plano de saude' })
  create(@Body() createHealthPlanDto: CreateHealthPlanDto) {
    return this.healthPlansService.create(createHealthPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar planos de saude' })
  findAll() {
    return this.healthPlansService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar plano de saude por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.healthPlansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar plano de saude' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHealthPlanDto: UpdateHealthPlanDto,
  ) {
    return this.healthPlansService.update(id, updateHealthPlanDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover plano de saude' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.healthPlansService.remove(id);
  }
}

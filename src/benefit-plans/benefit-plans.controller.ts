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
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';

import { BenefitPlansService } from './benefit-plans.service';
import { CreateBenefitPlanDto } from './dto/create-benefit-plan.dto';
import { ListBenefitPlansQueryDto } from './dto/list-benefit-plans-query.dto';
import { UpdateBenefitPlanDto } from './dto/update-benefit-plan.dto';

@ApiTags('benefit-plans')
@Roles(...STAFF_ROLES)
@Controller('benefit-plans')
export class BenefitPlansController {
  constructor(private readonly benefitPlansService: BenefitPlansService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar plano do cartão de benefícios',
    description:
      'Cota exige quantidade e procedimentos. Desconto exige percentual e não lista procedimentos.',
  })
  create(@Body() dto: CreateBenefitPlanDto) {
    return this.benefitPlansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar planos do cartão' })
  findAll(@Query() query: ListBenefitPlansQueryDto) {
    return this.benefitPlansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar plano do cartão por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.benefitPlansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar plano do cartão',
    description:
      'Alterar benefícios do catálogo não muda adesões já feitas. A troca falha se uma adesão ainda referencia um benefício removido.',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBenefitPlanDto,
  ) {
    return this.benefitPlansService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover plano do cartão' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.benefitPlansService.remove(id);
  }
}

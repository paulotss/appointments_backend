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
import { CreateInsuranceCardDto } from './dto/create-insurance-card.dto';
import { UpdateInsuranceCardDto } from './dto/update-insurance-card.dto';
import { InsuranceCardsService } from './insurance-cards.service';

@ApiTags('insurance-cards')
@Controller('insurance-cards')
export class InsuranceCardsController {
  constructor(private readonly insuranceCardsService: InsuranceCardsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar carteirinha' })
  create(@Body() createInsuranceCardDto: CreateInsuranceCardDto) {
    return this.insuranceCardsService.create(createInsuranceCardDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar carteirinhas' })
  findAll() {
    return this.insuranceCardsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar carteirinha por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.insuranceCardsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar carteirinha' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInsuranceCardDto: UpdateInsuranceCardDto,
  ) {
    return this.insuranceCardsService.update(id, updateInsuranceCardDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover carteirinha' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.insuranceCardsService.remove(id);
  }
}

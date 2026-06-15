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
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar produto' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar produtos' })
  @ApiQuery({
    name: 'all',
    required: false,
    description: 'Incluir produtos inativos',
  })
  findAll(@Query('all') all?: string) {
    return this.productsService.findAll(all !== undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar produto por id' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiQuery({
    name: 'all',
    required: false,
    description: 'Incluir produtos inativos',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('all') all?: string,
  ) {
    return this.productsService.findOne(id, all !== undefined);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar produto' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inativar produto' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}

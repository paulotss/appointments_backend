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
import { CreateStorageLocationDto } from './dto/create-storage-location.dto';
import { UpdateStorageLocationDto } from './dto/update-storage-location.dto';
import { StorageLocationsService } from './storage-locations.service';

@ApiTags('storage-locations')
@Controller('storage-locations')
export class StorageLocationsController {
  constructor(
    private readonly storageLocationsService: StorageLocationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar local de armazenamento' })
  create(@Body() createStorageLocationDto: CreateStorageLocationDto) {
    return this.storageLocationsService.create(createStorageLocationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar locais de armazenamento' })
  findAll() {
    return this.storageLocationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar local de armazenamento por id' })
  @ApiParam({ name: 'id', example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.storageLocationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar local de armazenamento' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStorageLocationDto: UpdateStorageLocationDto,
  ) {
    return this.storageLocationsService.update(id, updateStorageLocationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover local de armazenamento' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.storageLocationsService.remove(id);
  }
}

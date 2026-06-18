import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStorageLocationDto } from './dto/create-storage-location.dto';
import { UpdateStorageLocationDto } from './dto/update-storage-location.dto';

@Injectable()
export class StorageLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createStorageLocationDto: CreateStorageLocationDto) {
    return this.prisma.storageLocation.create({
      data: createStorageLocationDto,
    });
  }

  findAll() {
    return this.prisma.storageLocation.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const location = await this.prisma.storageLocation.findUnique({
      where: { id },
    });

    if (!location) {
      throw new NotFoundException(`Storage location ${id} not found`);
    }

    return location;
  }

  async update(id: number, updateStorageLocationDto: UpdateStorageLocationDto) {
    await this.findOne(id);

    return this.prisma.storageLocation.update({
      where: { id },
      data: updateStorageLocationDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.storageLocation.delete({ where: { id } });
  }
}

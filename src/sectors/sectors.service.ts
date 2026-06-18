import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createSectorDto: CreateSectorDto) {
    return this.prisma.sector.create({ data: createSectorDto });
  }

  findAll() {
    return this.prisma.sector.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const sector = await this.prisma.sector.findUnique({ where: { id } });

    if (!sector) {
      throw new NotFoundException(`Sector ${id} not found`);
    }

    return sector;
  }

  async update(id: number, updateSectorDto: UpdateSectorDto) {
    await this.findOne(id);

    return this.prisma.sector.update({
      where: { id },
      data: updateSectorDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.sector.delete({ where: { id } });
  }
}

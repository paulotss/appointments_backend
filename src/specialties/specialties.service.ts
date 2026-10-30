import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeName } from '../common/normalize-name';
import { isTissCbosCode } from '../common/tiss-cbos';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createSpecialtyDto: CreateSpecialtyDto) {
    this.assertCbos(createSpecialtyDto.cbosCode);
    return this.prisma.specialty.create({
      data: {
        ...createSpecialtyDto,
        name: normalizeName(createSpecialtyDto.name),
      },
    });
  }

  findAll() {
    return this.prisma.specialty.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });

    if (!specialty) {
      throw new NotFoundException(`Specialty ${id} not found`);
    }

    return specialty;
  }

  async update(id: number, updateSpecialtyDto: UpdateSpecialtyDto) {
    await this.findOne(id);
    if (updateSpecialtyDto.cbosCode !== undefined) {
      this.assertCbos(updateSpecialtyDto.cbosCode);
    }

    return this.prisma.specialty.update({
      where: { id },
      data: {
        ...updateSpecialtyDto,
        ...(updateSpecialtyDto.name !== undefined && {
          name: normalizeName(updateSpecialtyDto.name),
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.specialty.delete({ where: { id } });
  }

  private assertCbos(cbosCode: string) {
    if (!isTissCbosCode(cbosCode)) {
      throw new BadRequestException('cbosCode is not a TISS table 24 code');
    }
  }
}

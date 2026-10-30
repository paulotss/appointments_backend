import { BadRequestException } from '@nestjs/common';
import { SpecialtiesService } from './specialties.service';

describe('SpecialtiesService', () => {
  const prisma = {
    specialty: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
  };
  const service = new SpecialtiesService(prisma as never);

  it('lists specialties in alphabetical order', async () => {
    await service.findAll();
    expect(prisma.specialty.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('rejects a CBOS outside TISS table 24', () => {
    expect(() => service.create({ name: 'Clinica', cbosCode: '000000' })).toThrow(
      BadRequestException,
    );
    expect(prisma.specialty.create).not.toHaveBeenCalled();
  });
});

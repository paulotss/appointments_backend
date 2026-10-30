import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { requestingProfessionalLabel } from './requesting-professional-label';

@Injectable()
export class RequestingProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string) {
    const term = query.trim();
    const digits = term.replace(/\D/g, '');
    const where: Prisma.RequestingProfessionalWhereInput = term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { councilNumber: { contains: term, mode: 'insensitive' } },
            ...(digits ? [{ cbosCode: { contains: digits } }] : []),
          ],
        }
      : {};
    const rows = await this.prisma.requestingProfessional.findMany({
      where,
      orderBy: [{ name: 'asc' }, { cbosCode: 'asc' }],
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      councilType: row.councilType,
      councilNumber: row.councilNumber,
      councilUf: row.councilUf,
      cbosCode: row.cbosCode,
      label: requestingProfessionalLabel(row),
    }));
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { PayableStatus, Prisma } from '@prisma/client';
import {
  buildListMeta,
  ListEnvelope,
} from '../common/pagination/list-envelope';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../uploads/file-storage.service';
import { UploadedFile } from '../uploads/uploaded-file';
import {
  CreatePayableDto,
  ListPayablesQueryDto,
  PayPayableDto,
  UpdatePayableDto,
  type PayableSortField,
} from './dto/payable.dto';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const payableInclude = {
  supplier: true,
  documents: true,
  financialExit: true,
} as const;

function dueDateFilter(
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }
  return {
    ...(from !== undefined && { gte: new Date(from.slice(0, 10)) }),
    ...(to !== undefined && { lte: new Date(to.slice(0, 10)) }),
  };
}

function payableOrderBy(
  sortBy?: PayableSortField,
  sortOrder?: 'asc' | 'desc',
): Prisma.PayableOrderByWithRelationInput[] {
  if (sortBy === undefined) {
    return [{ id: 'desc' }];
  }
  const direction = sortOrder ?? 'asc';
  const primary: Prisma.PayableOrderByWithRelationInput = (() => {
    switch (sortBy) {
      case 'supplier':
        return { supplier: { tradeName: direction } };
      case 'description':
        return { description: direction };
      case 'kind':
        return { kind: direction };
      case 'amount':
        return { amount: direction };
      case 'dueDate':
        return { dueDate: direction };
      case 'status':
        return { status: direction };
    }
  })();
  return [primary, { id: 'desc' }];
}

@Injectable()
export class PayablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async create(dto: CreatePayableDto) {
    await this.ensureSupplierExists(dto.supplierId);
    return this.prisma.payable.create({
      data: {
        supplierId: dto.supplierId,
        kind: dto.kind,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        invoiceNumber: dto.invoiceNumber,
        notes: dto.notes,
      },
      include: payableInclude,
    });
  }

  async findAll(
    query: ListPayablesQueryDto,
  ): Promise<
    ListEnvelope<Prisma.PayableGetPayload<{ include: typeof payableInclude }>>
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const dueDate = dueDateFilter(query.from, query.to);
    const where: Prisma.PayableWhereInput = {
      ...(query.status !== undefined && { status: query.status }),
      ...(query.supplierId !== undefined && { supplierId: query.supplierId }),
      ...(dueDate !== undefined && { dueDate }),
    };

    const [data, total] = await Promise.all([
      this.prisma.payable.findMany({
        where,
        include: payableInclude,
        orderBy: payableOrderBy(query.sortBy, query.sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payable.count({ where }),
    ]);

    return { data, meta: buildListMeta(page, limit, total) };
  }

  async findOne(id: number) {
    const payable = await this.prisma.payable.findUnique({
      where: { id },
      include: payableInclude,
    });
    if (!payable) {
      throw new NotFoundException(`Payable ${id} not found`);
    }
    return payable;
  }

  async update(id: number, dto: UpdatePayableDto) {
    const payable = await this.findOne(id);
    this.assertPending(payable.status, 'updated');
    if (dto.supplierId !== undefined) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    return this.prisma.payable.update({
      where: { id },
      data: {
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.invoiceNumber !== undefined && {
          invoiceNumber: dto.invoiceNumber,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: payableInclude,
    });
  }

  async remove(id: number) {
    const payable = await this.findOne(id);
    this.assertPending(payable.status, 'deleted');
    for (const document of payable.documents) {
      await this.fileStorage.remove(document.storageKey);
    }
    return this.prisma.payable.delete({
      where: { id },
      include: payableInclude,
    });
  }

  async pay(id: number, dto: PayPayableDto) {
    const payable = await this.findOne(id);
    this.assertPending(payable.status, 'paid');
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const financialExit = await tx.financialExit.create({
        data: {
          payableId: id,
          amount: payable.amount,
          paymentMethod: dto.paymentMethod,
          paidAt,
        },
      });
      const updated = await tx.payable.update({
        where: { id },
        data: {
          status: PayableStatus.paid,
          paidAt,
        },
        include: payableInclude,
      });
      return { ...updated, financialExit };
    });
  }

  async addDocument(id: number, file: UploadedFile | undefined) {
    const payable = await this.findOne(id);
    this.assertPending(payable.status, 'updated');
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPEG and PNG documents are allowed',
      );
    }

    const storageKey = await this.fileStorage.savePayableFile(id, file);
    return this.prisma.financialDocument.create({
      data: {
        payableId: id,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async listDocuments(id: number) {
    const payable = await this.findOne(id);
    return payable.documents;
  }

  async openDocument(payableId: number, documentId: number) {
    await this.findOne(payableId);
    const document = await this.prisma.financialDocument.findFirst({
      where: { id: documentId, payableId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return {
      document,
      stream: createReadStream(
        this.fileStorage.absolutePath(document.storageKey),
      ),
    };
  }

  async removeDocument(payableId: number, documentId: number) {
    const payable = await this.findOne(payableId);
    this.assertPending(payable.status, 'updated');
    const document = payable.documents.find((item) => item.id === documentId);
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    await this.fileStorage.remove(document.storageKey);
    return this.prisma.financialDocument.delete({ where: { id: documentId } });
  }

  private assertPending(status: PayableStatus, action: string) {
    if (status !== PayableStatus.pending) {
      throw new BadRequestException(`Only pending payables can be ${action}`);
    }
  }

  private async ensureSupplierExists(supplierId: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }
  }
}

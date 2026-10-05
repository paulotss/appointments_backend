import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientFileKind, PatientFileOrigin } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../uploads/file-storage.service';
import type { UploadedFile } from '../uploads/uploaded-file';
import { CreateGeneratedPatientFileDto } from './dto/create-generated-patient-file.dto';
import { UpdateGeneratedPatientFileDto } from './dto/update-generated-patient-file.dto';
import {
  GeneratedFileKind,
  parseGeneratedContent,
  titleForGenerated,
} from './patient-file-content';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const UPLOAD_KINDS = new Set<string>([
  PatientFileKind.MEDICAL_ORDER,
  PatientFileKind.PRESCRIPTION,
  PatientFileKind.OTHER,
]);

const fileInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PatientFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async list(patientId: number) {
    await this.ensurePatient(patientId);
    return this.prisma.patientFile.findMany({
      where: { patientId },
      include: fileInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async upload(
    patientId: number,
    kindValue: string,
    file: UploadedFile | undefined,
    user: JwtPayload,
  ) {
    await this.ensurePatient(patientId);
    if (!UPLOAD_KINDS.has(kindValue)) {
      throw new BadRequestException('Informe o tipo do arquivo.');
    }
    if (!file) {
      throw new BadRequestException('Selecione um arquivo.');
    }
    const mimeType =
      file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
    if (
      !ALLOWED_MIME_TYPES.has(file.mimetype) &&
      !ALLOWED_MIME_TYPES.has(mimeType)
    ) {
      throw new BadRequestException(
        'Only PDF, JPEG and PNG documents are allowed',
      );
    }

    const kind = kindValue as PatientFileKind;
    const originalName = this.originalName(file.originalname);
    const storageKey = await this.fileStorage.savePatientFile(patientId, {
      ...file,
      originalname: originalName,
      mimetype: mimeType,
    });

    return this.prisma.patientFile.create({
      data: {
        patientId,
        kind,
        origin: PatientFileOrigin.UPLOAD,
        title: originalName,
        originalName,
        storageKey,
        mimeType,
        sizeBytes: file.size,
        createdByUserId: user.sub,
      },
      include: fileInclude,
    });
  }

  async createGenerated(
    patientId: number,
    dto: CreateGeneratedPatientFileDto,
    user: JwtPayload,
  ) {
    await this.ensurePatient(patientId);
    const content = parseGeneratedContent(dto.kind, dto.content);
    return this.prisma.patientFile.create({
      data: {
        patientId,
        kind: dto.kind,
        origin: PatientFileOrigin.GENERATED,
        title: titleForGenerated(dto.kind, content.date),
        content,
        createdByUserId: user.sub,
      },
      include: fileInclude,
    });
  }

  async updateGenerated(
    patientId: number,
    fileId: number,
    dto: UpdateGeneratedPatientFileDto,
  ) {
    const file = await this.findFile(patientId, fileId);
    if (file.origin !== PatientFileOrigin.GENERATED) {
      throw new BadRequestException(
        'Somente documentos gerados podem ser alterados.',
      );
    }
    if (file.kind === PatientFileKind.OTHER) {
      throw new BadRequestException(
        'Somente documentos gerados podem ser alterados.',
      );
    }
    const kind = file.kind as GeneratedFileKind;
    const content = parseGeneratedContent(kind, dto.content);
    return this.prisma.patientFile.update({
      where: { id: file.id },
      data: {
        content,
        title: titleForGenerated(kind, content.date),
      },
      include: fileInclude,
    });
  }

  async open(patientId: number, fileId: number) {
    const file = await this.findFile(patientId, fileId);
    if (
      file.origin !== PatientFileOrigin.UPLOAD ||
      !file.storageKey ||
      !file.mimeType ||
      !file.originalName
    ) {
      throw new BadRequestException(
        'Este documento é impresso na tela do paciente.',
      );
    }
    return {
      file,
      stream: await this.fileStorage.getStream(file.storageKey),
    };
  }

  async remove(patientId: number, fileId: number) {
    const file = await this.findFile(patientId, fileId);
    if (file.storageKey) {
      await this.fileStorage.remove(file.storageKey);
    }
    await this.prisma.patientFile.delete({ where: { id: file.id } });
    return { id: file.id };
  }

  private async ensurePatient(patientId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }
  }

  private async findFile(patientId: number, fileId: number) {
    const file = await this.prisma.patientFile.findFirst({
      where: { id: fileId, patientId },
      include: fileInclude,
    });
    if (!file) {
      throw new NotFoundException(`Document ${fileId} not found`);
    }
    return file;
  }

  private originalName(value: string): string {
    const base = value.split(/[/\\]/).pop()?.trim() || 'arquivo';
    return base.slice(0, 255);
  }
}

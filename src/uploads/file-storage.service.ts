import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { UploadedFile } from './uploaded-file';

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly bucket = process.env.R2_BUCKET ?? 'seraphis';
  private readonly client = new S3Client({
    region: process.env.R2_REGION ?? 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY ?? '',
      secretAccessKey: process.env.R2_SECRET_KEY ?? '',
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  async onModuleInit() {
    await this.ensureBucket();
  }

  async savePayableFile(payableId: number, file: UploadedFile): Promise<string> {
    return this.put(`payables/${payableId}/${this.objectName(file)}`, file);
  }

  async saveGuideFile(guideId: number, file: UploadedFile): Promise<string> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    return this.put(`guides/${guideId}/${safeName}`, file);
  }

  async put(key: string, file: UploadedFile): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return key;
  }

  async getStream(storageKey: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );
    if (!response.Body) {
      throw new NotFoundException(`Object ${storageKey} not found`);
    }
    if (response.Body instanceof Readable) {
      return response.Body;
    }
    return Readable.from(response.Body as AsyncIterable<Uint8Array>);
  }

  async getBuffer(storageKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );
    if (!response.Body) {
      throw new NotFoundException(`Object ${storageKey} not found`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async remove(storageKey: string): Promise<void> {
    await this.client
      .send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      )
      .catch(() => undefined);
  }

  private objectName(file: UploadedFile): string {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${randomUUID()}-${safeName}`;
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      this.logger.error(
        `R2 bucket ${this.bucket} is not reachable. Check R2_ENDPOINT, R2_BUCKET and API token permissions.`,
      );
      throw error;
    }
  }
}

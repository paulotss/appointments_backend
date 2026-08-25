import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { UploadedFile } from './uploaded-file';

@Injectable()
export class FileStorageService {
  private readonly uploadsDir =
    process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

  async savePayableFile(
    payableId: number,
    file: UploadedFile,
  ): Promise<string> {
    const folder = join(this.uploadsDir, 'payables', String(payableId));
    await mkdir(folder, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = join(
      'payables',
      String(payableId),
      `${randomUUID()}-${safeName}`,
    );
    await writeFile(join(this.uploadsDir, storageKey), file.buffer);
    return storageKey;
  }

  absolutePath(storageKey: string): string {
    return join(this.uploadsDir, storageKey);
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.absolutePath(storageKey)).catch(() => undefined);
  }
}

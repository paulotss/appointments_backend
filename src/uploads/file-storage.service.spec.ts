import { NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  const send = jest.fn();
  let service: FileStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FileStorageService();
    (service as unknown as { client: { send: typeof send } }).client = { send };
  });

  it('puts an object and returns the storage key', async () => {
    send.mockResolvedValue({});
    const key = await service.put('payables/1/nota.pdf', {
      originalname: 'nota.pdf',
      mimetype: 'application/pdf',
      size: 4,
      buffer: Buffer.from('test'),
    });
    expect(key).toBe('payables/1/nota.pdf');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('saves a payable file under payables/{id}/', async () => {
    send.mockResolvedValue({});
    const key = await service.savePayableFile(12, {
      originalname: 'boleto 1.pdf',
      mimetype: 'application/pdf',
      size: 8,
      buffer: Buffer.from('boleto'),
    });
    expect(key).toMatch(/^payables\/12\/.+-boleto_1\.pdf$/);
  });

  it('saves a guide file under guides/{id}/ with the given name', async () => {
    send.mockResolvedValue({});
    const key = await service.saveGuideFile(7, {
      originalname: '123_GUIA_7.png',
      mimetype: 'image/png',
      size: 8,
      buffer: Buffer.from('img'),
    });
    expect(key).toBe('guides/7/123_GUIA_7.png');
  });

  it('returns a readable stream for an existing object', async () => {
    const body = Readable.from([Buffer.from('arquivo')]);
    send.mockResolvedValue({ Body: body });
    const stream = await service.getStream('guides/7/file.png');
    expect(stream).toBe(body);
  });

  it('returns a buffer for an existing object', async () => {
    send.mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Uint8Array.from([1, 2])),
      },
    });
    const buffer = await service.getBuffer('guides/7/file.png');
    expect(buffer.equals(Buffer.from([1, 2]))).toBe(true);
  });

  it('throws when the object body is missing', async () => {
    send.mockResolvedValue({});
    await expect(service.getStream('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes an object', async () => {
    send.mockResolvedValue({});
    await service.remove('payables/1/nota.pdf');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('swallows errors when removing a missing object', async () => {
    send.mockRejectedValue(new Error('NoSuchKey'));
    await expect(service.remove('missing')).resolves.toBeUndefined();
  });
});

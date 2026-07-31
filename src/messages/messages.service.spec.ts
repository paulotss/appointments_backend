import { ForbiddenException } from '@nestjs/common';
import { CallRecordStatus } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { MessagesService } from './messages.service';

describe('MessagesService.findAll', () => {
  const prisma = {
    message: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const service = new MessagesService(prisma as never);

  const admin: JwtPayload = {
    sub: 1,
    usernameLogin: 'admin',
    isAdmin: true,
    jti: 'j1',
  };

  const attendant: JwtPayload = {
    sub: 10,
    usernameLogin: 'attendant',
    isAdmin: false,
    jti: 'j2',
  };

  const baseQuery: ListMessagesQueryDto = {
    from: '2026-07-31',
    to: '2026-07-31',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.message.findMany.mockResolvedValue([{ id: 1, name: 'A' }]);
    prisma.message.count.mockResolvedValue(1);
    prisma.message.groupBy.mockResolvedValue([
      { recordStatus: CallRecordStatus.pending, _count: { _all: 4 } },
      { recordStatus: CallRecordStatus.registered, _count: { _all: 1 } },
    ]);
  });

  it('filters by finishAt period (America/Sao_Paulo)', async () => {
    await service.findAll(baseQuery, admin);
    const where = prisma.message.findMany.mock.calls[0][0].where;
    expect(where.finishAt.gte.toISOString()).toBe('2026-07-31T03:00:00.000Z');
    expect(where.finishAt.lte.toISOString()).toBe('2026-08-01T02:59:59.999Z');
  });

  it('applies recordStatus on list but counts ignore it', async () => {
    const result = await service.findAll(
      { ...baseQuery, recordStatus: CallRecordStatus.registered },
      admin,
    );

    expect(prisma.message.findMany.mock.calls[0][0].where.recordStatus).toBe(
      CallRecordStatus.registered,
    );
    expect(
      prisma.message.groupBy.mock.calls[0][0].where.recordStatus,
    ).toBeUndefined();
    expect(result.counts).toEqual({
      pending: 4,
      registered: 1,
      cancelled: 0,
      total: 5,
    });
  });

  it('admin without userId has no user restriction', async () => {
    await service.findAll(baseQuery, admin);
    expect(prisma.message.findMany.mock.calls[0][0].where.userId).toBeUndefined();
  });

  it('admin with userId filters by that user', async () => {
    await service.findAll({ ...baseQuery, userId: 7 }, admin);
    expect(prisma.message.findMany.mock.calls[0][0].where.userId).toBe(7);
  });

  it('non-admin only sees own messages', async () => {
    await service.findAll(baseQuery, attendant);
    expect(prisma.message.findMany.mock.calls[0][0].where.userId).toBe(10);
  });

  it('non-admin cannot filter another userId', async () => {
    await expect(
      service.findAll({ ...baseQuery, userId: 99 }, attendant),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('omits content on list findMany', async () => {
    await service.findAll(baseQuery, admin);
    expect(prisma.message.findMany.mock.calls[0][0].omit).toEqual({
      content: true,
    });
  });

  it('paginates with page/limit/total/totalPages', async () => {
    prisma.message.count.mockResolvedValue(0);
    const result = await service.findAll(
      { ...baseQuery, page: 1, limit: 50 },
      admin,
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    });
    expect(prisma.message.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prisma.message.findMany.mock.calls[0][0].take).toBe(50);
  });
});

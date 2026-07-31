import { ForbiddenException } from '@nestjs/common';
import { CallRecordStatus, CallStatus } from '@prisma/client';
import { CallsService } from './calls.service';
import { ListCallsQueryDto } from './dto/list-calls-query.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('CallsService.findAll', () => {
  const prisma = {
    call: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const service = new CallsService(prisma as never);

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

  const baseQuery: ListCallsQueryDto = {
    from: '2026-07-31',
    to: '2026-07-31',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.call.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.call.count.mockResolvedValue(1);
    prisma.call.groupBy.mockResolvedValue([
      { recordStatus: CallRecordStatus.pending, _count: { _all: 2 } },
      { recordStatus: CallRecordStatus.registered, _count: { _all: 3 } },
      { recordStatus: CallRecordStatus.cancelled, _count: { _all: 1 } },
    ]);
  });

  it('filters by period (America/Sao_Paulo day bounds)', async () => {
    await service.findAll(baseQuery, admin);

    const where = prisma.call.findMany.mock.calls[0][0].where;
    expect(where.receivedAt.gte.toISOString()).toBe(
      '2026-07-31T03:00:00.000Z',
    );
    expect(where.receivedAt.lte.toISOString()).toBe(
      '2026-08-01T02:59:59.999Z',
    );
  });

  it('applies recordStatus on list/count but not on groupBy counts', async () => {
    await service.findAll(
      { ...baseQuery, recordStatus: CallRecordStatus.pending },
      admin,
    );

    expect(prisma.call.findMany.mock.calls[0][0].where.recordStatus).toBe(
      CallRecordStatus.pending,
    );
    expect(prisma.call.count.mock.calls[0][0].where.recordStatus).toBe(
      CallRecordStatus.pending,
    );
    expect(
      prisma.call.groupBy.mock.calls[0][0].where.recordStatus,
    ).toBeUndefined();
  });

  it('filters by statuses CSV-parsed values', async () => {
    await service.findAll(
      {
        ...baseQuery,
        statuses: [CallStatus.ATENDIDO, CallStatus.NAO_ATENDIDO],
      },
      admin,
    );

    expect(prisma.call.findMany.mock.calls[0][0].where.status).toEqual({
      in: [CallStatus.ATENDIDO, CallStatus.NAO_ATENDIDO],
    });
  });

  it('admin without userId has no user restriction', async () => {
    await service.findAll(baseQuery, admin);
    const where = prisma.call.findMany.mock.calls[0][0].where;
    expect(where.userId).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it('admin with userId filters by that user', async () => {
    await service.findAll({ ...baseQuery, userId: 42 }, admin);
    expect(prisma.call.findMany.mock.calls[0][0].where.userId).toBe(42);
  });

  it('non-admin sees own calls OR NAO_ATENDIDO', async () => {
    await service.findAll(baseQuery, attendant);
    expect(prisma.call.findMany.mock.calls[0][0].where.OR).toEqual([
      { userId: 10 },
      { status: CallStatus.NAO_ATENDIDO },
    ]);
  });

  it('non-admin cannot filter another userId', async () => {
    await expect(
      service.findAll({ ...baseQuery, userId: 99 }, attendant),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns counts ignoring recordStatus and paginated meta', async () => {
    prisma.call.count.mockResolvedValue(120);
    prisma.call.findMany.mockResolvedValue([]);

    const result = await service.findAll(
      {
        ...baseQuery,
        recordStatus: CallRecordStatus.pending,
        page: 2,
        limit: 50,
      },
      admin,
    );

    expect(result.meta).toEqual({
      page: 2,
      limit: 50,
      total: 120,
      totalPages: 3,
    });
    expect(result.counts).toEqual({
      pending: 2,
      registered: 3,
      cancelled: 1,
      total: 6,
    });
    expect(prisma.call.findMany.mock.calls[0][0].skip).toBe(50);
    expect(prisma.call.findMany.mock.calls[0][0].take).toBe(50);
  });
});

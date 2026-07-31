import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContactMethod } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AppointmentsService } from './appointments.service';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';

describe('AppointmentsService.findAll', () => {
  const prisma = {
    appointment: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const service = new AppointmentsService(prisma as never);

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

  const baseQuery: ListAppointmentsQueryDto = {
    from: '2026-07-01',
    to: '2026-07-31',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.appointment.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.appointment.count.mockResolvedValue(1);
    prisma.appointment.groupBy
      .mockResolvedValueOnce([
        { scheduled: true, _count: { _all: 4 } },
        { scheduled: false, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { firstTime: true, _count: { _all: 3 } },
        { firstTime: false, _count: { _all: 3 } },
      ]);
  });

  it('filters by period (America/Sao_Paulo day bounds)', async () => {
    await service.findAll(baseQuery, admin);

    const where = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.date.gte.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(where.date.lte.toISOString()).toBe('2026-08-01T02:59:59.999Z');
  });

  it('filters by contactMethod, firstTime, scheduled, specialtyId', async () => {
    await service.findAll(
      {
        ...baseQuery,
        contactMethod: ContactMethod.whatsapp,
        firstTime: true,
        scheduled: false,
        specialtyId: 3,
      },
      admin,
    );

    const where = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.contactMethod).toBe(ContactMethod.whatsapp);
    expect(where.firstTime).toBe(true);
    expect(where.scheduled).toBe(false);
    expect(where.specialtyId).toBe(3);
  });

  it('counts ignore firstTime/scheduled chip filters', async () => {
    await service.findAll(
      { ...baseQuery, firstTime: true, scheduled: false },
      admin,
    );

    const listWhere = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(listWhere.firstTime).toBe(true);
    expect(listWhere.scheduled).toBe(false);

    const scheduledGroupWhere = prisma.appointment.groupBy.mock.calls[0][0].where;
    const firstTimeGroupWhere = prisma.appointment.groupBy.mock.calls[1][0].where;
    expect(scheduledGroupWhere.firstTime).toBeUndefined();
    expect(scheduledGroupWhere.scheduled).toBeUndefined();
    expect(firstTimeGroupWhere.firstTime).toBeUndefined();
    expect(firstTimeGroupWhere.scheduled).toBeUndefined();
  });

  it('admin without attendantId has no attendant restriction', async () => {
    await service.findAll(baseQuery, admin);
    const where = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.attendantId).toBeUndefined();
  });

  it('admin with attendantId filters by that attendant', async () => {
    await service.findAll({ ...baseQuery, attendantId: 5 }, admin);
    expect(prisma.appointment.findMany.mock.calls[0][0].where.attendantId).toBe(
      5,
    );
  });

  it('non-admin only sees own appointments', async () => {
    await service.findAll(baseQuery, attendant);
    expect(prisma.appointment.findMany.mock.calls[0][0].where.attendantId).toBe(
      10,
    );
  });

  it('non-admin cannot filter another attendantId', async () => {
    await expect(
      service.findAll({ ...baseQuery, attendantId: 99 }, attendant),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('paginates with page/limit/total/totalPages and orders by date/id DESC', async () => {
    prisma.appointment.count.mockResolvedValue(120);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.findAll(
      { ...baseQuery, page: 2, limit: 50 },
      admin,
    );

    expect(result.meta).toEqual({
      page: 2,
      limit: 50,
      total: 120,
      totalPages: 3,
    });
    expect(result.counts).toEqual({
      scheduledYes: 4,
      scheduledNo: 2,
      firstTimeYes: 3,
      firstTimeNo: 3,
      total: 6,
    });
    expect(prisma.appointment.findMany.mock.calls[0][0].skip).toBe(50);
    expect(prisma.appointment.findMany.mock.calls[0][0].take).toBe(50);
    expect(prisma.appointment.findMany.mock.calls[0][0].orderBy).toEqual([
      { date: 'desc' },
      { id: 'desc' },
    ]);
  });
});

describe('AppointmentsService.exportAll', () => {
  const prisma = {
    appointment: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const service = new AppointmentsService(prisma as never);

  const admin: JwtPayload = {
    sub: 1,
    usernameLogin: 'admin',
    isAdmin: true,
    jti: 'j1',
  };

  const baseQuery: ListAppointmentsQueryDto = {
    from: '2026-07-01',
    to: '2026-07-31',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all filtered rows when under the safety limit', async () => {
    prisma.appointment.count.mockResolvedValue(2);
    prisma.appointment.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await service.exportAll(baseQuery, admin);

    expect(result).toHaveLength(2);
    expect(prisma.appointment.findMany.mock.calls[0][0].take).toBe(10_000);
    expect(prisma.appointment.findMany.mock.calls[0][0].orderBy).toEqual([
      { date: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('rejects export above the safety limit', async () => {
    prisma.appointment.count.mockResolvedValue(10_001);

    await expect(service.exportAll(baseQuery, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListAppointmentsQueryDto } from './list-appointments-query.dto';

describe('ListAppointmentsQueryDto', () => {
  async function validateQuery(input: Record<string, unknown>) {
    const dto = plainToInstance(ListAppointmentsQueryDto, input);
    return validate(dto);
  }

  it('accepts valid query and coerces types from query string', async () => {
    const dto = plainToInstance(ListAppointmentsQueryDto, {
      from: '2026-07-01',
      to: '2026-07-31',
      attendantId: '5',
      contactMethod: 'whatsapp',
      firstTime: 'true',
      scheduled: 'false',
      specialtyId: '3',
      page: '1',
      limit: '50',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.attendantId).toBe(5);
    expect(dto.contactMethod).toBe('whatsapp');
    expect(dto.firstTime).toBe(true);
    expect(dto.scheduled).toBe(false);
    expect(dto.specialtyId).toBe(3);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(50);
  });

  it('rejects missing from/to', async () => {
    const errors = await validateQuery({ page: 1 });
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['from', 'to']));
  });

  it('rejects invalid contactMethod', async () => {
    const errors = await validateQuery({
      from: '2026-07-01',
      to: '2026-07-31',
      contactMethod: 'sms',
    });
    expect(errors.some((e) => e.property === 'contactMethod')).toBe(true);
  });

  it('rejects limit above 100', async () => {
    const errors = await validateQuery({
      from: '2026-07-01',
      to: '2026-07-31',
      limit: 101,
    });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects page below 1', async () => {
    const errors = await validateQuery({
      from: '2026-07-01',
      to: '2026-07-31',
      page: 0,
    });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects invalid boolean strings', async () => {
    const errors = await validateQuery({
      from: '2026-07-01',
      to: '2026-07-31',
      firstTime: 'yes',
    });
    expect(errors.some((e) => e.property === 'firstTime')).toBe(true);
  });
});

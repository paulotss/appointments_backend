import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCallsQueryDto } from './list-calls-query.dto';

describe('ListCallsQueryDto', () => {
  async function validateQuery(input: Record<string, unknown>) {
    const dto = plainToInstance(ListCallsQueryDto, input);
    return validate(dto);
  }

  it('accepts valid query and parses statuses CSV', async () => {
    const dto = plainToInstance(ListCallsQueryDto, {
      from: '2026-07-31',
      to: '2026-07-31',
      recordStatus: 'pending',
      statuses: 'ATENDIDO,NAO_ATENDIDO',
      page: '1',
      limit: '50',
      userId: '3',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.statuses).toEqual(['ATENDIDO', 'NAO_ATENDIDO']);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(50);
    expect(dto.userId).toBe(3);
  });

  it('rejects missing from/to', async () => {
    const errors = await validateQuery({ page: 1 });
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['from', 'to']));
  });

  it('rejects invalid recordStatus', async () => {
    const errors = await validateQuery({
      from: '2026-07-31',
      to: '2026-07-31',
      recordStatus: 'done',
    });
    expect(errors.some((e) => e.property === 'recordStatus')).toBe(true);
  });

  it('rejects limit above 100', async () => {
    const errors = await validateQuery({
      from: '2026-07-31',
      to: '2026-07-31',
      limit: 101,
    });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects invalid statuses values', async () => {
    const errors = await validateQuery({
      from: '2026-07-31',
      to: '2026-07-31',
      statuses: 'INVALID',
    });
    expect(errors.some((e) => e.property === 'statuses')).toBe(true);
  });
});

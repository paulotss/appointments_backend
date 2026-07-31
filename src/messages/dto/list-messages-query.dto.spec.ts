import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListMessagesQueryDto } from './list-messages-query.dto';

describe('ListMessagesQueryDto', () => {
  it('accepts valid query', async () => {
    const dto = plainToInstance(ListMessagesQueryDto, {
      from: '2026-07-31',
      to: '2026-07-31',
      page: '2',
      limit: '25',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
  });

  it('rejects invalid query (400-equivalent validation errors)', async () => {
    const dto = plainToInstance(ListMessagesQueryDto, {
      from: 'not-a-date',
      to: '2026-07-31',
      limit: 0,
      page: 0,
    });
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['from', 'limit', 'page']));
  });
});

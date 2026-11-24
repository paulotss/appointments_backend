import { ValidationPipe } from '@nestjs/common';
import { ListInsuranceGuidesQueryDto } from './list-insurance-guides-query.dto';

describe('ListInsuranceGuidesQueryDto boolean filters', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const transform = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: ListInsuranceGuidesQueryDto,
    }) as Promise<ListInsuranceGuidesQueryDto>;

  it.each([
    ['isBilled', 'false', false],
    ['isBilled', 'true', true],
    ['availableForBilling', 'false', false],
    ['availableForBilling', 'true', true],
    ['withoutAppointment', 'false', false],
    ['withoutAppointment', 'true', true],
  ] as const)(
    'parses %s=%s as %s despite implicit conversion',
    async (field, raw, expected) => {
      const dto = await transform({ [field]: raw });
      expect(dto[field]).toBe(expected);
    },
  );

  it('keeps boolean filters undefined when omitted', async () => {
    const dto = await transform({});
    expect(dto.isBilled).toBeUndefined();
    expect(dto.availableForBilling).toBeUndefined();
    expect(dto.withoutAppointment).toBeUndefined();
  });

  it('keeps false boolean input as false', async () => {
    const dto = await transform({ isBilled: false });
    expect(dto.isBilled).toBe(false);
  });

  it('rejects non-boolean values', async () => {
    await expect(transform({ isBilled: 'yes' })).rejects.toThrow();
  });
});

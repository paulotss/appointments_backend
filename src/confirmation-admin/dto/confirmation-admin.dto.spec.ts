import { ValidationPipe } from '@nestjs/common';
import { CreateCampaignDto, ReplaceCampaignItemsDto } from './confirmation-admin.dto';
import { assertAppointmentRef } from '../refs';

describe('campaign item reference validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const item = (appointmentRef: string) => ({ appointmentRef, recipientState: 'PENDING' });
  const validate = (appointmentRef: string, create = false) => pipe.transform(
    { ...(create ? { campaignDate: '2026-11-16', source: 'SAUDEVIANET' } : {}), items: [item(appointmentRef)] },
    { type: 'body', metatype: create ? CreateCampaignDto : ReplaceCampaignItemsDto },
  );

  it.each(['appt', 'fail'])('accepts canonical %s references with the maximum key ID in both APIs', async prefix => {
    const ref = `${prefix}:v1:${'k'.repeat(32)}:${'a'.repeat(64)}`;
    expect(ref.length).toBeGreaterThan(81);
    expect(assertAppointmentRef(ref)).toBe(ref);
    await expect(validate(ref)).resolves.toBeInstanceOf(ReplaceCampaignItemsDto);
    await expect(validate(ref, true)).resolves.toBeInstanceOf(CreateCampaignDto);
  });

  it('preserves legacy short references', async () => {
    await expect(validate('appointment-fixture-1')).resolves.toBeDefined();
  });

  it.each([
    `appt:v1:${'k'.repeat(33)}:${'a'.repeat(64)}`,
    `appt:v1:${'k'.repeat(32)}:${'a'.repeat(63)}`,
    `appt:v1:${'k'.repeat(32)}:${'g'.repeat(64)}`,
    `appt:v2:${'k'.repeat(32)}:${'a'.repeat(64)}`,
    'x'.repeat(82),
  ])('rejects malformed long references', async ref => {
    await expect(validate(ref)).rejects.toThrow();
    await expect(validate(ref, true)).rejects.toThrow();
  });

  it('still rejects additional item fields', async () => {
    await expect(pipe.transform({ items: [{ ...item('fixture'), unexpected: 'fixture' }] },
      { type: 'body', metatype: ReplaceCampaignItemsDto })).rejects.toThrow();
  });
});

import { assertResponseDeadline, isUtcInstant } from './response-deadline';
import { validateResult } from './confirmation-results.service';
const now = new Date('2026-11-04T12:00:00Z');
const campaign = {
  campaignDate: new Date('2026-11-05'),
  responseDeadlineAt: new Date('2026-11-05T11:00:00Z'),
  items: [{ recipientState: 'ELIGIBLE', appointmentTime: '09:00' }],
};
describe('response deadline in São Paulo', () => {
  it('rejects calendar normalization and accepts canonical UTC with optional milliseconds', () => {
    expect(isUtcInstant('2026-02-30T10:00:00.000Z')).toBe(false);
    expect(isUtcInstant('2026-11-05T10:00:00.000Z')).toBe(true);
    expect(isUtcInstant('2026-11-05T10:00:00Z')).toBe(true);
  });
  it('accepts only a future instant before the earliest eligible appointment', () => {
    expect(() => assertResponseDeadline(campaign, now)).not.toThrow();
    for (const deadline of [
      null,
      new Date('invalid'),
      now,
      new Date('2026-11-05T12:00:00Z'),
      new Date('2026-11-06T00:00:00Z'),
    ])
      expect(() =>
        assertResponseDeadline(
          { ...campaign, responseDeadlineAt: deadline },
          now,
        ),
      ).toThrow();
  });
  it('blocks missing or malformed eligible times and checks the first eligible time', () => {
    for (const items of [
      [],
      [{ recipientState: 'ELIGIBLE', appointmentTime: null }],
      [{ recipientState: 'ELIGIBLE', appointmentTime: '25:00' }],
      [
        ...campaign.items,
        { recipientState: 'ELIGIBLE', appointmentTime: '07:00' },
      ],
    ])
      expect(() =>
        assertResponseDeadline({ ...campaign, items }, now),
      ).toThrow();
  });
  it('rejects unbound results and extra sensitive fields', () => {
    for (const body of [
      null,
      {},
      [],
      { phoneE164: 'fixture-rejected' },
      { revision: 'invalid' },
    ])
      expect(() => validateResult(body)).toThrow();
  });
});

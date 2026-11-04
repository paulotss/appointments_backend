import { httpCampaignSourceClient } from './appointment-source';

describe('campaign collection timeout', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, '90000'])('uses a bounded collection timeout (%s)', async (configured) => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = httpCampaignSourceClient({
      SAUDEVIANET_INTERNAL_API_BASE: 'http://fixture.invalid',
      SAUDEVIANET_INTERNAL_API_TOKEN: 'fixture-only',
      ...(configured === undefined ? {} : { SAUDEVIANET_CAMPAIGN_SOURCE_TIMEOUT_MS: configured }),
    }, request);
    await client.load('2099-03-06');
    expect(timeout).toHaveBeenCalledWith(configured === undefined ? 60000 : 90000);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'NaN', '0', '-1', '1000.5', '300001'])('rejects invalid timeout %s', (value) => {
    expect(() => httpCampaignSourceClient({ SAUDEVIANET_CAMPAIGN_SOURCE_TIMEOUT_MS: value }))
      .toThrow('invalid_campaign_source_timeout');
  });

  it('propagates collection failure instead of returning an empty agenda', async () => {
    const request = jest.fn().mockRejectedValue(new Error('timeout'));
    const client = httpCampaignSourceClient({
      SAUDEVIANET_INTERNAL_API_BASE: 'http://fixture.invalid',
      SAUDEVIANET_INTERNAL_API_TOKEN: 'fixture-only',
    }, request);
    await expect(client.load('2099-03-06')).rejects.toThrow('timeout');
  });
});

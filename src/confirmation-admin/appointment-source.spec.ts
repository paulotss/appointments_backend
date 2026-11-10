import {
  httpCampaignSourceClient,
  httpCampaignIdentityClient,
} from './appointment-source';

describe('Cloudflare Access service authentication', () => {
  const env = {
    SAUDEVIANET_INTERNAL_API_BASE: 'https://fixture.invalid',
    SAUDEVIANET_INTERNAL_API_TOKEN: 'origin-fixture',
    SAUDEVIANET_ACCESS_CLIENT_ID: 'client-fixture',
    SAUDEVIANET_ACCESS_CLIENT_SECRET: 'access-fixture',
  };
  it('adds independent Access credentials to each administrative read contract', async () => {
    const request = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    const source = httpCampaignSourceClient(env, request);
    const identity = httpCampaignIdentityClient(env, request);
    await source.load('2099-03-06');
    await source.classify([]);
    await identity.identify('2099-03-06');
    await identity.searchPatients('Paciente Ficticio', ['2099-03-06']);
    expect(request).toHaveBeenCalledTimes(4);
    for (const [, options] of request.mock.calls)
      expect(options.headers).toEqual(
        expect.objectContaining({
          'CF-Access-Client-Id': 'client-fixture',
          'CF-Access-Client-Secret': 'access-fixture',
          Authorization: 'Bearer origin-fixture',
        }),
      );
  });
  it('rejects partial, reused or insecure Access configuration before network I/O', () => {
    for (const change of [
      { SAUDEVIANET_ACCESS_CLIENT_SECRET: '' },
      { SAUDEVIANET_ACCESS_CLIENT_SECRET: 'origin-fixture' },
      { SAUDEVIANET_INTERNAL_API_BASE: 'http://fixture.invalid' },
    ]) {
      expect(() => httpCampaignSourceClient({ ...env, ...change })).toThrow(
        'invalid_source_access_configuration',
      );
      expect(() => httpCampaignIdentityClient({ ...env, ...change })).toThrow(
        'invalid_source_access_configuration',
      );
    }
  });
});

describe('campaign collection timeout', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, '90000'])(
    'uses a bounded collection timeout (%s)',
    async (configured) => {
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      const request = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({}) });
      const client = httpCampaignSourceClient(
        {
          SAUDEVIANET_INTERNAL_API_BASE: 'http://fixture.invalid',
          SAUDEVIANET_INTERNAL_API_TOKEN: 'fixture-only',
          ...(configured === undefined
            ? {}
            : { SAUDEVIANET_CAMPAIGN_SOURCE_TIMEOUT_MS: configured }),
        },
        request,
      );
      await client.load('2099-03-06');
      expect(timeout).toHaveBeenCalledWith(
        configured === undefined ? 60000 : 90000,
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['', 'NaN', '0', '-1', '1000.5', '300001'])(
    'rejects invalid timeout %s',
    (value) => {
      expect(() =>
        httpCampaignSourceClient({
          SAUDEVIANET_CAMPAIGN_SOURCE_TIMEOUT_MS: value,
        }),
      ).toThrow('invalid_campaign_source_timeout');
    },
  );

  it('propagates collection failure instead of returning an empty agenda', async () => {
    const request = jest.fn().mockRejectedValue(new Error('timeout'));
    const client = httpCampaignSourceClient(
      {
        SAUDEVIANET_INTERNAL_API_BASE: 'http://fixture.invalid',
        SAUDEVIANET_INTERNAL_API_TOKEN: 'fixture-only',
      },
      request,
    );
    await expect(client.load('2099-03-06')).rejects.toThrow('timeout');
  });
});

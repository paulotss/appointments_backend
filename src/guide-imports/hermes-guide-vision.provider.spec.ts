import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TissGuideType } from '@prisma/client';
import {
  collectHermesMessageText,
  DEFAULT_HERMES_API_BASE_URL,
  DEFAULT_HERMES_PROFILE,
  hermesChatCompletionsUrl,
  hermesSessionUrl,
  HermesGuideVisionProvider,
  newHermesGuideSessionId,
  resolveHermesProfile,
} from './hermes-guide-vision.provider';

const SPARSE_WITH_TRANSCRIPT = {
  transcript: `
GUIA DE CONSULTA
Registro ANS 346659
Operadora: CASSI
Nome do Beneficiário: MARIA SILVA
Número da Carteira: 0300021048000055
Nome do Profissional Executante: LUIZ FERNANDO VIEIRA
Conselho: CRM 3163 UF: DF
CBO-S: 225105
21 Codigo do Procedimento 10101012
Número da Guia na Operadora 794250219
Data do atendimento: 17/08/2026
`,
  tissGuideType: 'consulta',
  healthPlan: { name: null, registroAns: null },
  patient: { name: null, cardNumber: null, cardExpirationDate: null },
  professional: {
    name: null,
    councilType: null,
    councilNumber: null,
    councilUf: null,
    cbosCode: null,
    source: null,
  },
  procedures: [],
  guide: {
    operatorGuideNumber: null,
    providerGuideNumber: null,
    authorizationDate: null,
    passwordExpirationDate: null,
    attendanceDate: null,
  },
};

describe('resolveHermesProfile', () => {
  it('uses the higia profile by default', () => {
    expect(resolveHermesProfile(undefined)).toBe(DEFAULT_HERMES_PROFILE);
    expect(resolveHermesProfile('  ')).toBe(DEFAULT_HERMES_PROFILE);
  });

  it('keeps a configured profile and strips quotes', () => {
    expect(resolveHermesProfile('"higia-colaboradores"')).toBe(
      'higia-colaboradores',
    );
  });
});

describe('hermesChatCompletionsUrl', () => {
  it('targets the default tunnel and profile', () => {
    expect(hermesChatCompletionsUrl(undefined, undefined)).toBe(
      `${DEFAULT_HERMES_API_BASE_URL}/p/${DEFAULT_HERMES_PROFILE}/v1/chat/completions`,
    );
  });

  it('drops a trailing slash and encodes the profile', () => {
    expect(
      hermesChatCompletionsUrl(
        'https://hermes.example.com/',
        'higia colaboradores',
      ),
    ).toBe(
      'https://hermes.example.com/p/higia%20colaboradores/v1/chat/completions',
    );
  });
});

describe('hermesSessionUrl', () => {
  it('points at the profile session resource', () => {
    expect(
      hermesSessionUrl(
        'guide-abc',
        'https://hermes.paulodt.com.br',
        'higia-colaboradores',
      ),
    ).toBe(
      'https://hermes.paulodt.com.br/p/higia-colaboradores/api/sessions/guide-abc',
    );
  });
});

describe('newHermesGuideSessionId', () => {
  it('creates a distinct id for each import', () => {
    expect(newHermesGuideSessionId()).not.toBe(newHermesGuideSessionId());
  });
});

describe('collectHermesMessageText', () => {
  it('joins text parts from an array content payload', () => {
    expect(
      collectHermesMessageText({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: '{"tissGuideType":' },
                { type: 'text', text: '"consulta"}' },
              ],
            },
          },
        ],
      }),
    ).toBe('{"tissGuideType":\n"consulta"}');
  });
});

describe('HermesGuideVisionProvider', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.HERMES_API_KEY;
  const originalBase = process.env.HERMES_API_BASE_URL;
  const originalProfile = process.env.HERMES_PROFILE;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.HERMES_API_KEY;
    else process.env.HERMES_API_KEY = originalKey;
    if (originalBase === undefined) delete process.env.HERMES_API_BASE_URL;
    else process.env.HERMES_API_BASE_URL = originalBase;
    if (originalProfile === undefined) delete process.env.HERMES_PROFILE;
    else process.env.HERMES_PROFILE = originalProfile;
    jest.resetAllMocks();
  });

  it('rejects PDF without calling Hermes', async () => {
    process.env.HERMES_API_KEY = 'test-key';
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      new HermesGuideVisionProvider().extract({
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake-pdf'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requires HERMES_API_KEY', async () => {
    delete process.env.HERMES_API_KEY;

    await expect(
      new HermesGuideVisionProvider().extract({
        mimeType: 'image/png',
        buffer: Buffer.from('fake-image'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sends the profile model and a JPEG data URL', async () => {
    process.env.HERMES_API_KEY = 'test-key';
    process.env.HERMES_API_BASE_URL = 'https://hermes.paulodt.com.br';
    process.env.HERMES_PROFILE = 'higia-colaboradores';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'guide-echo' },
      text: async () =>
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify(SPARSE_WITH_TRANSCRIPT) } },
          ],
        }),
    }) as unknown as typeof fetch;

    const extracted = await new HermesGuideVisionProvider().extract({
      mimeType: 'image/jpg',
      buffer: Buffer.from('fake-image'),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hermes.paulodt.com.br/p/higia-colaboradores/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'X-Hermes-Session-Id': expect.stringMatching(/^guide-/),
        }),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hermes.paulodt.com.br/p/higia-colaboradores/api/sessions/guide-echo',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as {
      model: string;
      stream: boolean;
      messages: Array<{ content: unknown[] }>;
    };
    expect(body.model).toBe('higia-colaboradores');
    expect(body.stream).toBe(false);
    expect(body.messages[0].content[1]).toEqual({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${Buffer.from('fake-image').toString('base64')}`,
      },
    });
    expect(extracted.tissGuideType).toBe(TissGuideType.consulta);
    expect(extracted.healthPlan.name).toBe('CASSI');
    expect(extracted.patient.name).toBe('MARIA SILVA');
    expect(extracted.procedures[0]?.tissCode).toBe('10101012');
  });

  it('reports the tunnel as unreachable when fetch fails', async () => {
    process.env.HERMES_API_KEY = 'test-key';
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(
      new HermesGuideVisionProvider().extract({
        mimeType: 'image/png',
        buffer: Buffer.from('fake-image'),
      }),
    ).rejects.toMatchObject({
      message: 'Hermes vision is unreachable',
    });
  });

  it('fails when Hermes returns an HTTP error', async () => {
    process.env.HERMES_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
      text: async () => '{"error":{"message":"Invalid gateway API key"}}',
    }) as unknown as typeof fetch;

    await expect(
      new HermesGuideVisionProvider().extract({
        mimeType: 'image/png',
        buffer: Buffer.from('fake-image'),
      }),
    ).rejects.toMatchObject({
      message: 'Hermes vision failed to extract guide data',
    });
    const sessionId = (global.fetch as jest.Mock).mock.calls[0][1].headers[
      'X-Hermes-Session-Id'
    ] as string;
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(`/api/sessions/${sessionId}`),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

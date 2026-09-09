import { TissGuideType } from '@prisma/client';
import {
  collectOpenRouterMessageText,
  DEFAULT_OPENROUTER_VISION_FALLBACKS,
  DEFAULT_OPENROUTER_VISION_MODEL,
  openRouterModelCandidates,
  OpenRouterGuideVisionProvider,
  parseOpenRouterModelList,
  shouldTryNextOpenRouterModel,
} from './openrouter-guide-vision.provider';

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

describe('parseOpenRouterModelList', () => {
  it('keeps a single paid slug', () => {
    expect(parseOpenRouterModelList('inclusionai/ling-3.0-flash')).toEqual([
      'inclusionai/ling-3.0-flash',
    ]);
  });

  it('parses a comma-separated list and drops duplicates', () => {
    expect(
      parseOpenRouterModelList(
        ' inclusionai/ling-3.0-flash , thinkingmachines/inkling-small, inclusionai/ling-3.0-flash ',
      ),
    ).toEqual(['inclusionai/ling-3.0-flash', 'thinkingmachines/inkling-small']);
  });
});

describe('shouldTryNextOpenRouterModel', () => {
  it('retries the next model when a paid slug returns 404', () => {
    expect(
      shouldTryNextOpenRouterModel(
        404,
        JSON.stringify({
          error: { message: 'No endpoints found for this model.' },
        }),
      ),
    ).toBe(true);
  });

  it('retries the next model when the upstream pool returns 429', () => {
    expect(
      shouldTryNextOpenRouterModel(
        429,
        JSON.stringify({
          error: { message: 'temporarily rate-limited upstream' },
        }),
      ),
    ).toBe(true);
  });

  it('retries the next model when a text-only model rejects image input', () => {
    expect(
      shouldTryNextOpenRouterModel(
        400,
        JSON.stringify({
          error: { message: 'This model does not support image inputs' },
        }),
      ),
    ).toBe(true);
  });

  it('does not retry unrelated 400 errors', () => {
    expect(
      shouldTryNextOpenRouterModel(
        400,
        JSON.stringify({ error: { message: 'max_tokens is too large' } }),
      ),
    ).toBe(false);
  });
});

describe('openRouterModelCandidates', () => {
  it('uses only the configured models, in order', () => {
    expect(
      openRouterModelCandidates(
        'inclusionai/ling-3.0-flash,thinkingmachines/inkling-small',
      ),
    ).toEqual(['inclusionai/ling-3.0-flash', 'thinkingmachines/inkling-small']);
  });

  it('falls back to Ling then a paid vision model when none is configured', () => {
    expect(openRouterModelCandidates('')).toEqual([
      DEFAULT_OPENROUTER_VISION_MODEL,
      ...DEFAULT_OPENROUTER_VISION_FALLBACKS,
    ]);
  });
});

describe('collectOpenRouterMessageText', () => {
  it('reads string content from chat completions', () => {
    expect(
      collectOpenRouterMessageText({
        choices: [{ message: { content: '{"tissGuideType":"consulta"}' } }],
      }),
    ).toBe('{"tissGuideType":"consulta"}');
  });

  it('joins multipart text content', () => {
    expect(
      collectOpenRouterMessageText({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: '{"a":1}' },
                { type: 'text', text: '{"b":2}' },
              ],
            },
          },
        ],
      }),
    ).toBe('{"a":1}\n{"b":2}');
  });
});

describe('OpenRouterGuideVisionProvider', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.OPENROUTER_VISION_MODEL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENROUTER_VISION_MODEL;
    else process.env.OPENROUTER_VISION_MODEL = originalModel;
    jest.resetAllMocks();
  });

  it('sends the configured paid model with a data URL image', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_VISION_MODEL = 'inclusionai/ling-3.0-flash';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify(SPARSE_WITH_TRANSCRIPT) } },
          ],
        }),
    }) as unknown as typeof fetch;

    const extracted = await new OpenRouterGuideVisionProvider().extract({
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as { model: string; messages: Array<{ content: unknown[] }> };
    expect(body.model).toBe('inclusionai/ling-3.0-flash');
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

  it('falls back to the next configured paid model after 404', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_VISION_MODEL =
      'inclusionai/ling-3.0-flash,thinkingmachines/inkling-small';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              message: 'No endpoints found for this model.',
              code: 404,
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify(SPARSE_WITH_TRANSCRIPT) } },
            ],
          }),
      }) as unknown as typeof fetch;

    const extracted = await new OpenRouterGuideVisionProvider().extract({
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });

    const models = (global.fetch as jest.Mock).mock.calls.map(
      (call) => JSON.parse(call[1].body as string).model,
    );
    expect(models).toEqual([
      'inclusionai/ling-3.0-flash',
      'thinkingmachines/inkling-small',
    ]);
    expect(extracted.healthPlan.name).toBe('CASSI');
  });
});

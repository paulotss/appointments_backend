import { TissGuideType } from '@prisma/client';
import {
  collectOpenRouterMessageText,
  openRouterModelCandidates,
  OpenRouterGuideVisionProvider,
  shouldTryNextOpenRouterModel,
  withOpenRouterFreeVariant,
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

describe('withOpenRouterFreeVariant', () => {
  it('keeps an existing :free suffix', () => {
    expect(withOpenRouterFreeVariant('google/gemma-4-31b-it:free')).toBe(
      'google/gemma-4-31b-it:free',
    );
  });

  it('appends :free and never keeps a paid slug', () => {
    expect(withOpenRouterFreeVariant('google/gemma-4-31b-it')).toBe(
      'google/gemma-4-31b-it:free',
    );
  });
});

describe('shouldTryNextOpenRouterModel', () => {
  it('retries only other free models when :free returns 404', () => {
    expect(
      shouldTryNextOpenRouterModel(
        404,
        JSON.stringify({
          error: { message: 'This model is unavailable for free.' },
        }),
        'qwen/qwen2.5-vl-72b-instruct:free',
      ),
    ).toBe(true);
  });

  it('retries the next free model when the upstream pool returns 429', () => {
    expect(
      shouldTryNextOpenRouterModel(
        429,
        JSON.stringify({
          error: { message: 'temporarily rate-limited upstream' },
        }),
        'google/gemma-4-31b-it:free',
      ),
    ).toBe(true);
  });

  it('does not fall back to a paid slug', () => {
    expect(
      shouldTryNextOpenRouterModel(
        404,
        'not found',
        'qwen/qwen2.5-vl-72b-instruct',
      ),
    ).toBe(false);
  });
});

describe('openRouterModelCandidates', () => {
  it('uses only :free slugs from distinct providers', () => {
    expect(
      openRouterModelCandidates('qwen/qwen2.5-vl-72b-instruct:free'),
    ).toEqual([
      'qwen/qwen2.5-vl-72b-instruct:free',
      'dots-studio/dots-3-note-preview:free',
      'nex-agi/nex-n2.5-mini:free',
      'thinkingmachines/inkling-small:free',
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

  it('sends the free document vision model with a data URL image', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_VISION_MODEL =
      'dots-studio/dots-3-note-preview:free';
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
    expect(body.model).toBe('dots-studio/dots-3-note-preview:free');
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

  it('falls back to another free vision model, never a paid slug', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_VISION_MODEL = 'qwen/qwen2.5-vl-72b-instruct:free';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              message: 'This model is unavailable for free.',
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
      'qwen/qwen2.5-vl-72b-instruct:free',
      'dots-studio/dots-3-note-preview:free',
    ]);
    expect(models.every((item: string) => item.endsWith(':free'))).toBe(true);
    expect(extracted.healthPlan.name).toBe('CASSI');
  });
});

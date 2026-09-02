import { TissGuideType } from '@prisma/client';
import {
  collectGeminiCandidateText,
  GeminiGuideVisionProvider,
  GEMINI_JSON_SCHEMA,
  thinkingConfigForModel,
} from './gemini-guide-vision.provider';

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

describe('thinkingConfigForModel', () => {
  it('uses MINIMAL thinking on Gemini 3.x', () => {
    expect(thinkingConfigForModel('gemini-3.5-flash')).toEqual({
      thinkingConfig: {
        thinkingLevel: 'MINIMAL',
        includeThoughts: false,
      },
    });
  });

  it('disables thinking budget on Gemini 2.5', () => {
    expect(thinkingConfigForModel('gemini-2.5-flash')).toEqual({
      thinkingConfig: {
        thinkingBudget: 0,
        includeThoughts: false,
      },
    });
  });
});

describe('GEMINI_JSON_SCHEMA', () => {
  it('requires nested objects so the model cannot return only tissGuideType', () => {
    expect(GEMINI_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining([
        'transcript',
        'healthPlan',
        'patient',
        'professional',
        'procedures',
        'guide',
      ]),
    );
  });
});

describe('collectGeminiCandidateText', () => {
  it('skips thought parts and keeps the JSON payload', () => {
    const text = collectGeminiCandidateText({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: 'I should be careful and use nulls.' },
              { text: '{"tissGuideType":"consulta"}' },
            ],
          },
        },
      ],
    });
    expect(text).toBe('{"tissGuideType":"consulta"}');
  });
});

describe('GeminiGuideVisionProvider', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  });

  it('completes a sparse Gemini JSON from the transcript', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-3.5-flash';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ text: JSON.stringify(SPARSE_WITH_TRANSCRIPT) }],
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const extracted = await new GeminiGuideVisionProvider().extract({
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });

    expect(extracted.tissGuideType).toBe(TissGuideType.consulta);
    expect(extracted.healthPlan.name).toBe('CASSI');
    expect(extracted.healthPlan.registroAns).toBe('346659');
    expect(extracted.patient.name).toBe('MARIA SILVA');
    expect(extracted.patient.cardNumber).toBe('0300021048000055');
    expect(extracted.professional.name).toBe('LUIZ FERNANDO VIEIRA');
    expect(extracted.procedures[0]?.tissCode).toBe('10101012');
    expect(extracted.guide.operatorGuideNumber).toBe('794250219');
  });
});

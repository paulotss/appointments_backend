import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseExtractedGuideResponse } from './extracted-guide';
import { GUIDE_EXTRACTION_PROMPT } from './guide-import.prompt';
import { completeExtractedGuideFromTranscript } from './guide-import.transcript';
import type {
  GuideVisionProvider,
  VisionDocument,
} from './guide-vision.provider';

function nullableString() {
  return { type: 'STRING', nullable: true };
}

function objectSchema(properties: Record<string, unknown>, required: string[]) {
  return {
    type: 'OBJECT',
    properties,
    required,
  };
}

export const GEMINI_JSON_SCHEMA = objectSchema(
  {
    transcript: { type: 'STRING' },
    tissGuideType: nullableString(),
    healthPlan: objectSchema(
      {
        name: nullableString(),
        registroAns: nullableString(),
      },
      ['name', 'registroAns'],
    ),
    patient: objectSchema(
      {
        name: nullableString(),
        cardNumber: nullableString(),
        cardExpirationDate: nullableString(),
      },
      ['name', 'cardNumber', 'cardExpirationDate'],
    ),
    professional: objectSchema(
      {
        name: nullableString(),
        councilType: nullableString(),
        councilNumber: nullableString(),
        councilUf: nullableString(),
        cbosCode: nullableString(),
        source: nullableString(),
      },
      [
        'name',
        'councilType',
        'councilNumber',
        'councilUf',
        'cbosCode',
        'source',
      ],
    ),
    procedures: {
      type: 'ARRAY',
      items: objectSchema(
        {
          tissCode: nullableString(),
          description: nullableString(),
          requestedQuantity: { type: 'INTEGER', nullable: true },
          authorizedQuantity: { type: 'INTEGER', nullable: true },
        },
        ['tissCode', 'description', 'requestedQuantity', 'authorizedQuantity'],
      ),
    },
    guide: objectSchema(
      {
        operatorGuideNumber: nullableString(),
        providerGuideNumber: nullableString(),
        authorizationDate: nullableString(),
        passwordExpirationDate: nullableString(),
        attendanceDate: nullableString(),
      },
      [
        'operatorGuideNumber',
        'providerGuideNumber',
        'authorizationDate',
        'passwordExpirationDate',
        'attendanceDate',
      ],
    ),
  },
  [
    'transcript',
    'tissGuideType',
    'healthPlan',
    'patient',
    'professional',
    'procedures',
    'guide',
  ],
);

type GeminiPart = {
  text?: string;
  thought?: boolean;
};

export function thinkingConfigForModel(model: string): Record<string, unknown> {
  if (/gemini-3/i.test(model)) {
    return {
      thinkingConfig: {
        thinkingLevel: 'MINIMAL',
        includeThoughts: false,
      },
    };
  }
  if (/gemini-2\.5/i.test(model)) {
    return {
      thinkingConfig: {
        thinkingBudget: 0,
        includeThoughts: false,
      },
    };
  }
  return {};
}

export function collectGeminiCandidateText(payload: {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
}): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const texts = parts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter((text) => text.length > 0);
  if (texts.length === 0) return '';
  const jsonLike = [...texts]
    .reverse()
    .find((text) => text.startsWith('{') || text.startsWith('```'));
  return jsonLike ?? texts.join('\n');
}

@Injectable()
export class GeminiGuideVisionProvider implements GuideVisionProvider {
  private readonly logger = new Logger(GeminiGuideVisionProvider.name);

  async extract(document: VisionDocument) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const generationConfig = (includeExtras: boolean) => ({
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_JSON_SCHEMA,
      ...(includeExtras
        ? {
            mediaResolution: 'MEDIA_RESOLUTION_HIGH',
            ...thinkingConfigForModel(model),
          }
        : {}),
    });

    const requestBody = (includeExtras: boolean) =>
      JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: document.mimeType,
                  data: document.buffer.toString('base64'),
                },
              },
              { text: GUIDE_EXTRACTION_PROMPT },
            ],
          },
        ],
        generationConfig: generationConfig(includeExtras),
      });

    const post = (includeExtras: boolean) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody(includeExtras),
      }).catch((error: unknown) => {
        this.logger.error(
          `Gemini request failed (${error instanceof Error ? error.message : 'unknown'})`,
        );
        throw new ServiceUnavailableException(
          'Vision provider failed to extract guide data',
        );
      });

    let response = await post(true);
    if (response.status === 400) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Gemini ${model} HTTP 400: ${body.slice(0, 500)}; retrying without thinking/media config`,
      );
      response = await post(false);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `Gemini ${model} HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }>;
    };
    const finishReason = payload.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      this.logger.warn(`Gemini ${model} finishReason=${finishReason}`);
    }

    const text = collectGeminiCandidateText(payload);
    if (!text) {
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    const { extracted, transcript } = parseExtractedGuideResponse(text);
    const completed = completeExtractedGuideFromTranscript(
      extracted,
      transcript,
    );
    this.logger.log(
      `Gemini ${model} fields: type=${completed.tissGuideType ?? 'null'} plan=${completed.healthPlan.name ? 'yes' : 'no'} ans=${completed.healthPlan.registroAns ? 'yes' : 'no'} patient=${completed.patient.name ? 'yes' : 'no'} card=${completed.patient.cardNumber ? 'yes' : 'no'} professional=${completed.professional.name ? 'yes' : 'no'} procedures=${completed.procedures.length} transcriptChars=${transcript.length}`,
    );
    return completed;
  }
}

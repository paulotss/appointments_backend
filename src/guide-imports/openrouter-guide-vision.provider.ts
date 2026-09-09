import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseExtractedGuideResponse } from './extracted-guide';
import { GUIDE_JSON_EXTRACTION_PROMPT } from './guide-import.prompt';
import { completeExtractedGuideFromTranscript } from './guide-import.transcript';
import type {
  GuideVisionProvider,
  VisionDocument,
} from './guide-vision.provider';

const REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Paid Ling 3.0 Flash — text-only; PDFs go through OpenRouter's file-parser. */
export const DEFAULT_OPENROUTER_VISION_MODEL = 'inclusionai/ling-3.0-flash';

/**
 * Paid vision fallback used when the env list is empty.
 * Photos of guias need a multimodal model; Ling 3.0 Flash is text-only.
 */
export const DEFAULT_OPENROUTER_VISION_FALLBACKS = [
  'thinkingmachines/inkling-small',
] as const;

type OpenRouterMessageContent =
  | string
  | Array<{ type?: string; text?: string }>;

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: { content?: OpenRouterMessageContent };
  }>;
  error?: { message?: string };
};

export function parseOpenRouterModelList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function openRouterModelCandidates(model: string): string[] {
  const configured = parseOpenRouterModelList(model);
  if (configured.length > 0) {
    return configured;
  }
  return [
    DEFAULT_OPENROUTER_VISION_MODEL,
    ...DEFAULT_OPENROUTER_VISION_FALLBACKS,
  ];
}

export function collectOpenRouterMessageText(
  payload: OpenRouterChatResponse,
): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
}

export function shouldTryNextOpenRouterModel(
  status: number,
  body: string,
): boolean {
  if (status === 404 || status === 429) {
    return true;
  }
  if (status !== 400) {
    return false;
  }
  const lower = body.toLowerCase();
  return (
    lower.includes('does not support') ||
    lower.includes('input modalit') ||
    lower.includes('image input') ||
    lower.includes('image_url') ||
    lower.includes('not a multimodal') ||
    lower.includes('multimodal')
  );
}

@Injectable()
export class OpenRouterGuideVisionProvider implements GuideVisionProvider {
  private readonly logger = new Logger(OpenRouterGuideVisionProvider.name);

  async extract(document: VisionDocument) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is not configured',
      );
    }

    const baseUrl = (
      process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL
    ).replace(/\/$/, '');
    const candidates = openRouterModelCandidates(
      process.env.OPENROUTER_VISION_MODEL ?? '',
    );

    let lastError = '';
    for (const model of candidates) {
      const result = await this.complete(baseUrl, apiKey, model, document);
      if (result.ok) {
        return this.parseCompletion(model, result.payload);
      }
      lastError = `OpenRouter ${model} HTTP ${result.status}: ${result.body.slice(0, 500)}`;
      if (shouldTryNextOpenRouterModel(result.status, result.body)) {
        this.logger.warn(
          `OpenRouter ${model} is unavailable; trying next candidate`,
        );
        continue;
      }
      this.logger.error(lastError);
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    this.logger.error(lastError || 'OpenRouter vision model is unavailable');
    throw new ServiceUnavailableException(
      'OpenRouter vision model is unavailable',
    );
  }

  private async complete(
    baseUrl: string,
    apiKey: string,
    model: string,
    document: VisionDocument,
  ): Promise<
    | { ok: true; payload: OpenRouterChatResponse }
    | { ok: false; status: number; body: string }
  > {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seraphis.local',
        'X-OpenRouter-Title': 'Seraphis guide import',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        temperature: 0,
        stream: false,
        ...(document.mimeType === 'application/pdf'
          ? {
              plugins: [
                { id: 'file-parser', pdf: { engine: 'cloudflare-ai' } },
              ],
            }
          : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: GUIDE_JSON_EXTRACTION_PROMPT },
              this.documentPart(document),
            ],
          },
        ],
      }),
    }).catch((error: unknown) => {
      this.logger.error(
        `OpenRouter request failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      throw new ServiceUnavailableException('OpenRouter vision is unreachable');
    });

    const body = await response.text().catch(() => '');
    if (!response.ok) {
      return { ok: false, status: response.status, body };
    }

    try {
      return {
        ok: true,
        payload: JSON.parse(body) as OpenRouterChatResponse,
      };
    } catch {
      return { ok: false, status: response.status, body };
    }
  }

  private parseCompletion(model: string, payload: OpenRouterChatResponse) {
    if (payload.error?.message) {
      this.logger.error(`OpenRouter ${model}: ${payload.error.message}`);
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    const text = collectOpenRouterMessageText(payload);
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
      `OpenRouter ${model} fields: type=${completed.tissGuideType ?? 'null'} plan=${completed.healthPlan.name ? 'yes' : 'no'} ans=${completed.healthPlan.registroAns ? 'yes' : 'no'} patient=${completed.patient.name ? 'yes' : 'no'} card=${completed.patient.cardNumber ? 'yes' : 'no'} professional=${completed.professional.name ? 'yes' : 'no'} procedures=${completed.procedures.length} transcriptChars=${transcript.length}`,
    );
    return completed;
  }

  private documentPart(document: VisionDocument) {
    const data = document.buffer.toString('base64');
    if (document.mimeType === 'application/pdf') {
      return {
        type: 'file',
        file: {
          filename: 'guia.pdf',
          file_data: `data:application/pdf;base64,${data}`,
        },
      };
    }

    const mimeType =
      document.mimeType === 'image/jpg' ? 'image/jpeg' : document.mimeType;
    return {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${data}`,
      },
    };
  }
}

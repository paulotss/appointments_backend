import { randomUUID } from 'crypto';
import {
  BadRequestException,
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
const SESSION_CLOSE_TIMEOUT_MS = 15_000;

export const DEFAULT_HERMES_API_BASE_URL = 'https://hermes.paulodt.com.br';
export const DEFAULT_HERMES_PROFILE = 'higia-colaboradores';

const PDF_MESSAGE = 'Hermes guide vision accepts JPEG and PNG only';

type HermesMessageContent = string | Array<{ type?: string; text?: string }>;

type HermesChatResponse = {
  choices?: Array<{
    message?: { content?: HermesMessageContent };
  }>;
  error?: { message?: string };
};

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function resolveHermesProfile(
  value = process.env.HERMES_PROFILE,
): string {
  const profile = unquote(value ?? '');
  return profile || DEFAULT_HERMES_PROFILE;
}

export function hermesApiRoot(
  baseUrl = process.env.HERMES_API_BASE_URL,
  profile = process.env.HERMES_PROFILE,
): string {
  const base = unquote(baseUrl ?? '').replace(/\/$/, '');
  const origin = base || DEFAULT_HERMES_API_BASE_URL;
  return `${origin}/p/${encodeURIComponent(resolveHermesProfile(profile))}`;
}

export function hermesChatCompletionsUrl(
  baseUrl = process.env.HERMES_API_BASE_URL,
  profile = process.env.HERMES_PROFILE,
): string {
  return `${hermesApiRoot(baseUrl, profile)}/v1/chat/completions`;
}

export function hermesSessionUrl(
  sessionId: string,
  baseUrl = process.env.HERMES_API_BASE_URL,
  profile = process.env.HERMES_PROFILE,
): string {
  return `${hermesApiRoot(baseUrl, profile)}/api/sessions/${encodeURIComponent(sessionId)}`;
}

export function newHermesGuideSessionId(): string {
  return `guide-${randomUUID()}`;
}

export function collectHermesMessageText(payload: HermesChatResponse): string {
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

function imageMimeType(mimeType: string): 'image/jpeg' | 'image/png' | null {
  if (mimeType === 'image/jpg' || mimeType === 'image/jpeg') {
    return 'image/jpeg';
  }
  if (mimeType === 'image/png') {
    return 'image/png';
  }
  return null;
}

@Injectable()
export class HermesGuideVisionProvider implements GuideVisionProvider {
  private readonly logger = new Logger(HermesGuideVisionProvider.name);

  async extract(document: VisionDocument) {
    const mimeType = imageMimeType(document.mimeType);
    if (!mimeType) {
      throw new BadRequestException(PDF_MESSAGE);
    }

    const apiKey = process.env.HERMES_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('HERMES_API_KEY is not configured');
    }

    const profile = resolveHermesProfile();
    const url = hermesChatCompletionsUrl();
    let sessionId = newHermesGuideSessionId();
    try {
      return await this.complete(
        apiKey,
        profile,
        url,
        sessionId,
        mimeType,
        document,
        (id) => {
          sessionId = id;
        },
      );
    } finally {
      await this.closeSession(apiKey, sessionId);
    }
  }

  private async complete(
    apiKey: string,
    profile: string,
    url: string,
    sessionId: string,
    mimeType: 'image/jpeg' | 'image/png',
    document: VisionDocument,
    adoptSessionId: (sessionId: string) => void,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Hermes-Session-Id': sessionId,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: profile,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: GUIDE_JSON_EXTRACTION_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${document.buffer.toString('base64')}`,
                },
              },
            ],
          },
        ],
      }),
    }).catch((error: unknown) => {
      this.logger.error(
        `Hermes request failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      throw new ServiceUnavailableException('Hermes vision is unreachable');
    });

    const echoed = response.headers?.get('x-hermes-session-id')?.trim();
    if (echoed) {
      adoptSessionId(echoed);
    }

    const body = await response.text().catch(() => '');
    if (!response.ok) {
      this.logger.error(
        `Hermes ${profile} HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        'Hermes vision failed to extract guide data',
      );
    }

    let payload: HermesChatResponse;
    try {
      payload = JSON.parse(body) as HermesChatResponse;
    } catch {
      this.logger.error(`Hermes ${profile} returned invalid JSON`);
      throw new ServiceUnavailableException(
        'Hermes vision failed to extract guide data',
      );
    }

    if (payload.error?.message) {
      this.logger.error(`Hermes ${profile}: ${payload.error.message}`);
      throw new ServiceUnavailableException(
        'Hermes vision failed to extract guide data',
      );
    }

    const text = collectHermesMessageText(payload);
    if (!text) {
      throw new ServiceUnavailableException(
        'Hermes vision failed to extract guide data',
      );
    }

    const { extracted, transcript } = parseExtractedGuideResponse(text);
    const completed = completeExtractedGuideFromTranscript(
      extracted,
      transcript,
    );
    this.logger.log(
      `Hermes ${profile} fields: type=${completed.tissGuideType ?? 'null'} plan=${completed.healthPlan.name ? 'yes' : 'no'} ans=${completed.healthPlan.registroAns ? 'yes' : 'no'} patient=${completed.patient.name ? 'yes' : 'no'} card=${completed.patient.cardNumber ? 'yes' : 'no'} professional=${completed.professional.name ? 'yes' : 'no'} procedures=${completed.procedures.length} transcriptChars=${transcript.length}`,
    );
    return completed;
  }

  private async closeSession(apiKey: string, sessionId: string) {
    try {
      const response = await fetch(hermesSessionUrl(sessionId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(SESSION_CLOSE_TIMEOUT_MS),
      });
      if (!response.ok && response.status !== 404) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Hermes session ${sessionId} close HTTP ${response.status}: ${body.slice(0, 200)}`,
        );
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Hermes session ${sessionId} close failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }
  }
}

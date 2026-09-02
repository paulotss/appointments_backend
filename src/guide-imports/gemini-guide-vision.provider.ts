import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { parseExtractedGuideJson } from './extracted-guide';
import { GUIDE_EXTRACTION_PROMPT } from './guide-import.prompt';
import type {
  GuideVisionProvider,
  VisionDocument,
} from './guide-vision.provider';

const GEMINI_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tissGuideType: { type: 'STRING', nullable: true },
    healthPlan: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', nullable: true },
        registroAns: { type: 'STRING', nullable: true },
      },
    },
    patient: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', nullable: true },
        cardNumber: { type: 'STRING', nullable: true },
        cardExpirationDate: { type: 'STRING', nullable: true },
      },
    },
    professional: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', nullable: true },
        councilType: { type: 'STRING', nullable: true },
        councilNumber: { type: 'STRING', nullable: true },
        councilUf: { type: 'STRING', nullable: true },
        cbosCode: { type: 'STRING', nullable: true },
        source: { type: 'STRING', nullable: true },
      },
    },
    procedures: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tissCode: { type: 'STRING', nullable: true },
          description: { type: 'STRING', nullable: true },
          requestedQuantity: { type: 'INTEGER', nullable: true },
          authorizedQuantity: { type: 'INTEGER', nullable: true },
        },
      },
    },
    guide: {
      type: 'OBJECT',
      properties: {
        operatorGuideNumber: { type: 'STRING', nullable: true },
        providerGuideNumber: { type: 'STRING', nullable: true },
        authorizationDate: { type: 'STRING', nullable: true },
        passwordExpirationDate: { type: 'STRING', nullable: true },
        attendanceDate: { type: 'STRING', nullable: true },
      },
    },
  },
};

@Injectable()
export class GeminiGuideVisionProvider implements GuideVisionProvider {
  async extract(document: VisionDocument) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GUIDE_EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType: document.mimeType,
                  data: document.buffer.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_JSON_SCHEMA,
        },
      }),
    }).catch((error: unknown) => {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? 'Vision provider failed to extract guide data'
          : 'Vision provider failed to extract guide data',
      );
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    return parseExtractedGuideJson(text);
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseExtractedGuideJson } from './extracted-guide';
import {
  extractionPromptFromTranscript,
  GUIDE_TRANSCRIPTION_PROMPT,
} from './guide-import.prompt';
import { completeExtractedGuideFromTranscript } from './guide-import.transcript';
import type {
  GuideVisionProvider,
  VisionDocument,
} from './guide-vision.provider';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/jpg']);
const REQUEST_TIMEOUT_MS = 180_000;

type OllamaChatResponse = {
  message?: { content?: string };
};

@Injectable()
export class OllamaGuideVisionProvider implements GuideVisionProvider {
  private readonly logger = new Logger(OllamaGuideVisionProvider.name);

  async extract(document: VisionDocument) {
    if (!IMAGE_MIME_TYPES.has(document.mimeType)) {
      throw new BadRequestException(
        'Local vision model requires a JPEG or PNG image (not PDF)',
      );
    }

    const baseUrl = (
      process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
    const visionModel =
      process.env.OLLAMA_VISION_MODEL?.trim() || 'qwen2.5vl';
    const textModel =
      process.env.OLLAMA_TEXT_MODEL?.trim() || visionModel;

    const transcript = await this.chat(baseUrl, {
      model: visionModel,
      format: undefined,
      numPredict: 2048,
      messages: [
        {
          role: 'user',
          content: GUIDE_TRANSCRIPTION_PROMPT,
          images: [document.buffer.toString('base64')],
        },
      ],
    });

    this.logger.log(
      `Transcription received (${transcript.trim().length} chars) via ${visionModel}`,
    );

    let extracted = parseExtractedGuideJson('{}');
    try {
      const jsonText = await this.chat(baseUrl, {
        model: textModel,
        format: 'json',
        numPredict: 1024,
        messages: [
          {
            role: 'user',
            content: extractionPromptFromTranscript(transcript),
          },
        ],
      });
      extracted = parseExtractedGuideJson(jsonText);
    } catch (error) {
      this.logger.warn(
        `JSON extraction from transcript failed; using transcription heuristics (${error instanceof Error ? error.message : 'unknown'})`,
      );
    }

    return completeExtractedGuideFromTranscript(extracted, transcript);
  }

  private async chat(
    baseUrl: string,
    input: {
      model: string;
      format?: 'json';
      numPredict: number;
      messages: Array<{
        role: 'user';
        content: string;
        images?: string[];
      }>;
    },
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: input.model,
        stream: false,
        ...(input.format ? { format: input.format } : {}),
        options: { temperature: 0, num_predict: input.numPredict },
        messages: input.messages,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }

    const payload = (await response.json()) as OllamaChatResponse;
    const text = payload.message?.content?.trim();
    if (!text) {
      throw new ServiceUnavailableException(
        'Vision provider failed to extract guide data',
      );
    }
    return text;
  }
}

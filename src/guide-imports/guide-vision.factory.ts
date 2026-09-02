import { Logger } from '@nestjs/common';
import { GeminiGuideVisionProvider } from './gemini-guide-vision.provider';
import { OllamaGuideVisionProvider } from './ollama-guide-vision.provider';
import type { GuideVisionProvider } from './guide-vision.provider';

const logger = new Logger('GuideVision');

export function resolveGuideVisionProviderKind(
  value = process.env.GUIDE_VISION_PROVIDER,
): 'gemini' | 'ollama' {
  const kind = (value ?? 'ollama')
    .trim()
    .toLowerCase()
    .replace(/^['"]|['"]$/g, '');
  if (process.env.RENDER) {
    return 'gemini';
  }
  return kind === 'gemini' ? 'gemini' : 'ollama';
}

export function createGuideVisionProvider(): GuideVisionProvider {
  const kind = resolveGuideVisionProviderKind();
  logger.log(`Using ${kind} vision provider`);
  if (kind === 'gemini') {
    return new GeminiGuideVisionProvider();
  }
  return new OllamaGuideVisionProvider();
}

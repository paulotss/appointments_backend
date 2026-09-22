import { Logger } from '@nestjs/common';
import { GeminiGuideVisionProvider } from './gemini-guide-vision.provider';
import { OpenRouterGuideVisionProvider } from './openrouter-guide-vision.provider';
import type { GuideVisionProvider } from './guide-vision.provider';

const logger = new Logger('GuideVision');

export type GuideVisionProviderKind = 'openrouter' | 'gemini';

export function resolveGuideVisionProviderKind(
  value = process.env.GUIDE_VISION_PROVIDER,
): GuideVisionProviderKind {
  const kind = (value ?? 'openrouter')
    .trim()
    .toLowerCase()
    .replace(/^['"]|['"]$/g, '');
  if (kind === 'gemini') {
    return 'gemini';
  }
  return 'openrouter';
}

export function createGuideVisionProvider(): GuideVisionProvider {
  const kind = resolveGuideVisionProviderKind();
  logger.log(`Using ${kind} vision provider`);
  if (kind === 'gemini') {
    return new GeminiGuideVisionProvider();
  }
  return new OpenRouterGuideVisionProvider();
}

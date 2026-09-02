import { GeminiGuideVisionProvider } from './gemini-guide-vision.provider';
import { OllamaGuideVisionProvider } from './ollama-guide-vision.provider';
import type { GuideVisionProvider } from './guide-vision.provider';

export function createGuideVisionProvider(): GuideVisionProvider {
  const kind = (process.env.GUIDE_VISION_PROVIDER ?? 'gemini')
    .trim()
    .toLowerCase();
  if (kind === 'ollama') {
    return new OllamaGuideVisionProvider();
  }
  return new GeminiGuideVisionProvider();
}

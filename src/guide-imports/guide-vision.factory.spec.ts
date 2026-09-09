import { resolveGuideVisionProviderKind } from './guide-vision.factory';

describe('resolveGuideVisionProviderKind', () => {
  const originalRender = process.env.RENDER;
  const originalProvider = process.env.GUIDE_VISION_PROVIDER;

  afterEach(() => {
    if (originalRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = originalRender;
    if (originalProvider === undefined)
      delete process.env.GUIDE_VISION_PROVIDER;
    else process.env.GUIDE_VISION_PROVIDER = originalProvider;
  });

  it('uses OpenRouter by default in production and development', () => {
    process.env.RENDER = 'true';
    delete process.env.GUIDE_VISION_PROVIDER;
    expect(resolveGuideVisionProviderKind()).toBe('openrouter');
  });

  it('uses OpenRouter locally by default', () => {
    delete process.env.RENDER;
    delete process.env.GUIDE_VISION_PROVIDER;
    expect(resolveGuideVisionProviderKind()).toBe('openrouter');
  });

  it('keeps Gemini when explicitly configured', () => {
    process.env.GUIDE_VISION_PROVIDER = 'gemini';
    expect(resolveGuideVisionProviderKind()).toBe('gemini');
  });

  it('keeps Ollama when explicitly configured', () => {
    process.env.GUIDE_VISION_PROVIDER = 'ollama';
    expect(resolveGuideVisionProviderKind()).toBe('ollama');
  });
});

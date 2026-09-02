import { resolveGuideVisionProviderKind } from './guide-vision.factory';

describe('resolveGuideVisionProviderKind', () => {
  const originalRender = process.env.RENDER;
  const originalProvider = process.env.GUIDE_VISION_PROVIDER;

  afterEach(() => {
    if (originalRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = originalRender;
    if (originalProvider === undefined) delete process.env.GUIDE_VISION_PROVIDER;
    else process.env.GUIDE_VISION_PROVIDER = originalProvider;
  });

  it('uses Gemini on Render even if Ollama is configured', () => {
    process.env.RENDER = 'true';
    process.env.GUIDE_VISION_PROVIDER = 'ollama';
    expect(resolveGuideVisionProviderKind()).toBe('gemini');
  });

  it('uses Ollama locally by default', () => {
    delete process.env.RENDER;
    delete process.env.GUIDE_VISION_PROVIDER;
    expect(resolveGuideVisionProviderKind()).toBe('ollama');
  });
});

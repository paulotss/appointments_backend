import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PortalRagService } from './portal-rag.service';

describe('PortalRagService', () => {
  const originalFetch = global.fetch;
  const originalOllama = process.env.OLLAMA_BASE_URL;
  const originalBrain = process.env.PORTAL_BRAIN_URL;
  let service: PortalRagService;

  beforeEach(() => {
    service = new PortalRagService();
    process.env.OLLAMA_BASE_URL = 'http://ollama.test:11434';
    process.env.PORTAL_BRAIN_URL = 'http://brain.test:8088';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalOllama === undefined) {
      delete process.env.OLLAMA_BASE_URL;
    } else {
      process.env.OLLAMA_BASE_URL = originalOllama;
    }
    if (originalBrain === undefined) {
      delete process.env.PORTAL_BRAIN_URL;
    } else {
      process.env.PORTAL_BRAIN_URL = originalBrain;
    }
    jest.resetAllMocks();
  });

  function mockFetchSequence(
    handlers: Array<(url: string) => Promise<Response> | Response>,
  ) {
    let call = 0;
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL) => {
        const url = String(input);
        const handler = handlers[call];
        call += 1;
        if (!handler) {
          throw new Error(`Unexpected fetch: ${url}`);
        }
        return handler(url);
      },
    );
  }

  it('returns available true when Ollama responds 2xx', async () => {
    mockFetchSequence([() => new Response('{}', { status: 200 })]);

    await expect(service.getStatus()).resolves.toEqual({ available: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ollama.test:11434/api/tags',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns available false when Ollama is unreachable', async () => {
    mockFetchSequence([() => Promise.reject(new Error('connect refused'))]);

    await expect(service.getStatus()).resolves.toEqual({ available: false });
  });

  it('returns available false when Ollama responds 5xx', async () => {
    mockFetchSequence([() => new Response('fail', { status: 500 })]);

    await expect(service.getStatus()).resolves.toEqual({ available: false });
  });

  it('asks the portal brain when Ollama is up', async () => {
    mockFetchSequence([
      () => new Response('{}', { status: 200 }),
      (url) => {
        expect(url).toBe('http://brain.test:8088/ask');
        return new Response(
          JSON.stringify({
            answer: 'Prazo de 72 horas.',
            sources: ['https://portal.exemplo/unimed'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    ]);

    await expect(service.ask('Qual o prazo da Unimed?')).resolves.toEqual({
      answer: 'Prazo de 72 horas.',
      sources: ['https://portal.exemplo/unimed'],
    });
  });

  it('rejects ask when Ollama is down', async () => {
    mockFetchSequence([() => Promise.reject(new Error('timeout'))]);

    await expect(service.ask('Qual o prazo da Unimed?')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects ask when portal brain URL is missing', async () => {
    delete process.env.PORTAL_BRAIN_URL;
    mockFetchSequence([() => new Response('{}', { status: 200 })]);

    await expect(service.ask('Qual o prazo da Unimed?')).rejects.toMatchObject({
      message: 'Portal knowledge service is unreachable',
    });
  });

  it('rejects ask when portal brain is unreachable', async () => {
    mockFetchSequence([
      () => new Response('{}', { status: 200 }),
      () => Promise.reject(new Error('ECONNREFUSED')),
    ]);

    await expect(service.ask('Qual o prazo da Unimed?')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects ask when portal brain returns invalid payload', async () => {
    mockFetchSequence([
      () => new Response('{}', { status: 200 }),
      () =>
        new Response(JSON.stringify({ sources: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ]);

    await expect(service.ask('Qual o prazo da Unimed?')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

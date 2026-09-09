import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const OLLAMA_STATUS_TIMEOUT_MS = 3_000;
const ASK_TIMEOUT_MS = 180_000;

type PortalBrainAskResponse = {
  answer?: unknown;
  sources?: unknown;
};

@Injectable()
export class PortalRagService {
  private readonly logger = new Logger(PortalRagService.name);

  getStatus() {
    return this.isOllamaAvailable().then((available) => ({ available }));
  }

  async isOllamaAvailable(): Promise<boolean> {
    const baseUrl = this.ollamaBaseUrl();
    if (!baseUrl) {
      return false;
    }

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(OLLAMA_STATUS_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async ask(question: string): Promise<{ answer: string; sources: string[] }> {
    if (!(await this.isOllamaAvailable())) {
      throw new ServiceUnavailableException('Local model is unreachable');
    }

    const brainUrl = this.portalBrainUrl();
    if (!brainUrl) {
      throw new ServiceUnavailableException(
        'Portal knowledge service is unreachable',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${brainUrl}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
        body: JSON.stringify({ question }),
      });
    } catch (error: unknown) {
      this.logger.error(
        `Portal brain is unreachable at ${brainUrl} (${error instanceof Error ? error.message : 'unknown'})`,
      );
      throw new ServiceUnavailableException(
        'Portal knowledge service is unreachable',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException('Portal knowledge service failed');
    }

    let payload: PortalBrainAskResponse;
    try {
      payload = (await response.json()) as PortalBrainAskResponse;
    } catch {
      throw new BadGatewayException('Portal knowledge service failed');
    }

    const answer =
      typeof payload.answer === 'string' ? payload.answer.trim() : '';
    if (!answer) {
      throw new BadGatewayException('Portal knowledge service failed');
    }

    const sources = Array.isArray(payload.sources)
      ? payload.sources.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];

    return { answer, sources };
  }

  private ollamaBaseUrl(): string {
    return (
      process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
  }

  private portalBrainUrl(): string | null {
    const url = process.env.PORTAL_BRAIN_URL?.trim();
    if (!url) {
      return null;
    }
    return url.replace(/\/$/, '');
  }
}

import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AgentDataService } from '../agent-data/agent-data.service';
import {
  DEFAULT_HIGIA_MODEL,
  executeHigiaTool,
  buildHigiaSystemPrompt,
  HIGIA_TOOLS,
} from './higia.tools';

const REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_TOOL_ROUNDS = 8;

type ChatContent = string | Array<{ type?: string; text?: string }>;

type ToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type ChatMessage = {
  role: string;
  content?: ChatContent | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: ChatMessage;
  }>;
  error?: { message?: string };
};

export type HigiaHistoryItem = { role: 'user' | 'assistant'; content: string };

export type HigiaStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'delta'; text: string }
  | { type: 'done' };

type StreamToolCallDelta = {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type OpenRouterStreamChunk = {
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      tool_calls?: StreamToolCallDelta[];
    };
  }>;
  error?: { message?: string };
};

@Injectable()
export class HigiaService {
  private readonly logger = new Logger(HigiaService.name);

  constructor(private readonly agentData: AgentDataService) {}

  getStatus() {
    return { available: Boolean(this.apiKey()) };
  }

  async ask(
    question: string,
    history: HigiaHistoryItem[] = [],
  ): Promise<{ answer: string }> {
    const apiKey = this.requireApiKey();
    const messages = this.buildMessages(question, history);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const payload = await this.complete(apiKey, messages);
      const message = payload.choices?.[0]?.message;
      if (!message) {
        throw new BadGatewayException('Higia model returned an empty response');
      }

      const toolCalls = message.tool_calls?.filter(
        (call) => call.function?.name,
      );
      if (toolCalls && toolCalls.length > 0) {
        await this.appendToolRound(
          messages,
          message.content ?? null,
          toolCalls,
        );
        continue;
      }

      const answer = this.collectText(message.content);
      if (!answer) {
        throw new BadGatewayException('Higia model returned an empty response');
      }
      return { answer };
    }

    throw new BadGatewayException('Higia exceeded the tool call limit');
  }

  async *askStream(
    question: string,
    history: HigiaHistoryItem[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<HigiaStreamEvent> {
    const apiKey = this.requireApiKey();
    const messages = this.buildMessages(question, history);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      if (signal?.aborted) {
        return;
      }

      const response = await this.requestCompletion(
        apiKey,
        messages,
        true,
        signal,
      );
      let sawTool = false;
      let announcedStatus = false;
      let answer = '';
      const toolCalls = new Map<number, ToolCall>();

      for await (const chunk of this.readStreamChunks(response, signal)) {
        if (chunk.error?.message) {
          this.logger.error(`OpenRouter Higia: ${chunk.error.message}`);
          throw new BadGatewayException('Higia model request failed');
        }

        const delta = chunk.choices?.[0]?.delta;
        const calls = delta?.tool_calls ?? [];
        if (calls.length > 0) {
          sawTool = true;
          if (!announcedStatus) {
            announcedStatus = true;
            yield { type: 'status', message: 'Consultando...' };
          }
          this.mergeToolCallDeltas(toolCalls, calls);
        }

        const text = delta?.content;
        if (!sawTool && typeof text === 'string' && text) {
          answer += text;
          yield { type: 'delta', text };
        }
      }

      if (signal?.aborted) {
        return;
      }

      if (sawTool) {
        const calls = [...toolCalls.entries()]
          .sort((left, right) => left[0] - right[0])
          .map(([, call]) => call)
          .filter((call) => call.function?.name);
        if (calls.length === 0) {
          throw new BadGatewayException(
            'Higia model returned an empty response',
          );
        }
        if (!announcedStatus) {
          yield { type: 'status', message: 'Consultando...' };
        }
        await this.appendToolRound(messages, null, calls);
        continue;
      }

      if (!answer.trim()) {
        throw new BadGatewayException('Higia model returned an empty response');
      }
      yield { type: 'done' };
      return;
    }

    throw new BadGatewayException('Higia exceeded the tool call limit');
  }

  private async runTool(name: string, rawArguments?: string) {
    let parsed: unknown = {};
    if (rawArguments) {
      try {
        parsed = JSON.parse(rawArguments) as unknown;
      } catch {
        return { error: 'Invalid tool arguments JSON' };
      }
    }
    try {
      return await executeHigiaTool(this.agentData, name, parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tool execution failed';
      this.logger.warn(`Higia tool ${name} failed: ${message}`);
      return { error: message };
    }
  }

  private requireApiKey(): string {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is not configured',
      );
    }
    return apiKey;
  }

  private buildMessages(
    question: string,
    history: HigiaHistoryItem[],
  ): ChatMessage[] {
    return [
      { role: 'system', content: buildHigiaSystemPrompt() },
      ...history
        .filter((item) => item.content.trim())
        .slice(-30)
        .map((item) => ({
          role: item.role,
          content: item.content,
        })),
      { role: 'user', content: question.trim() },
    ];
  }

  private async appendToolRound(
    messages: ChatMessage[],
    content: ChatContent | null,
    toolCalls: ToolCall[],
  ) {
    messages.push({
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      const name = call.function?.name ?? 'unknown';
      const result = await this.runTool(name, call.function?.arguments);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result),
      });
    }
  }

  private mergeToolCallDeltas(
    toolCalls: Map<number, ToolCall>,
    deltas: StreamToolCallDelta[],
  ) {
    for (const delta of deltas) {
      const index = delta.index ?? 0;
      const current = toolCalls.get(index) ?? {
        id: undefined,
        type: 'function',
        function: { name: '', arguments: '' },
      };
      if (delta.id) {
        current.id = delta.id;
      }
      if (delta.type) {
        current.type = delta.type;
      }
      if (delta.function?.name) {
        current.function = {
          name: `${current.function?.name ?? ''}${delta.function.name}`,
          arguments: current.function?.arguments ?? '',
        };
      }
      if (delta.function?.arguments) {
        current.function = {
          name: current.function?.name ?? '',
          arguments: `${current.function?.arguments ?? ''}${delta.function.arguments}`,
        };
      }
      toolCalls.set(index, current);
    }
  }

  private async complete(
    apiKey: string,
    messages: ChatMessage[],
  ): Promise<OpenRouterChatResponse> {
    const response = await this.requestCompletion(apiKey, messages, false);
    const body = await response.text();
    if (!response.ok) {
      this.logger.error(
        `OpenRouter Higia HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
      throw new BadGatewayException('Higia model request failed');
    }

    let payload: OpenRouterChatResponse;
    try {
      payload = JSON.parse(body) as OpenRouterChatResponse;
    } catch {
      throw new BadGatewayException('Higia model request failed');
    }

    if (payload.error?.message) {
      this.logger.error(`OpenRouter Higia: ${payload.error.message}`);
      throw new BadGatewayException('Higia model request failed');
    }

    return payload;
  }

  private async requestCompletion(
    apiKey: string,
    messages: ChatMessage[],
    stream: boolean,
    signal?: AbortSignal,
  ): Promise<Response> {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }

    const baseUrl = (
      process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL
    ).replace(/\/$/, '');
    const model =
      process.env.OPENROUTER_HIGIA_MODEL?.trim() || DEFAULT_HIGIA_MODEL;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://seraphis.local',
          'X-OpenRouter-Title': 'Higia',
        },
        signal: this.requestSignal(signal),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          stream,
          tools: HIGIA_TOOLS,
          tool_choice: 'auto',
          messages,
        }),
      });
    } catch (error: unknown) {
      if (signal?.aborted) {
        throw error;
      }
      this.logger.error(
        `OpenRouter is unreachable (${error instanceof Error ? error.message : 'unknown'})`,
      );
      throw new ServiceUnavailableException('OpenRouter is unreachable');
    }

    if (!response.ok && stream) {
      const body = await response.text();
      this.logger.error(
        `OpenRouter Higia HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
      throw new BadGatewayException('Higia model request failed');
    }

    return response;
  }

  private requestSignal(external?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    if (!external) {
      return timeout;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (external.aborted || timeout.aborted) {
      controller.abort();
      return controller.signal;
    }
    external.addEventListener('abort', abort, { once: true });
    timeout.addEventListener('abort', abort, { once: true });
    return controller.signal;
  }

  private async *readStreamChunks(
    response: Response,
    signal?: AbortSignal,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    if (!response.body) {
      throw new BadGatewayException('Higia model request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (!signal?.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, '\n');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const chunk of this.parseSseLines(lines)) {
          yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (signal?.aborted) {
      return;
    }

    buffer += decoder.decode();
    const tail = buffer.replace(/\r\n/g, '\n').trim();
    if (tail) {
      for (const chunk of this.parseSseLines(tail.split('\n'))) {
        yield chunk;
      }
    }
  }

  private *parseSseLines(lines: string[]): Generator<OpenRouterStreamChunk> {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }
      let chunk: OpenRouterStreamChunk;
      try {
        chunk = JSON.parse(data) as OpenRouterStreamChunk;
      } catch {
        throw new BadGatewayException('Higia model request failed');
      }
      yield chunk;
    }
  }

  private collectText(content: ChatContent | null | undefined): string {
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

  private apiKey(): string | undefined {
    const key = process.env.OPENROUTER_API_KEY?.trim();
    return key || undefined;
  }
}

import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AgentDataService } from '../agent-data/agent-data.service';
import { todayYmdSaoPaulo } from '../common/datetime/sao-paulo-day-bounds';
import { HigiaService, type HigiaStreamEvent } from './higia.service';

describe('HigiaService', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.OPENROUTER_HIGIA_MODEL;
  const agentData = {
    getOverview: jest.fn(),
  };
  let service: HigiaService;

  beforeEach(() => {
    service = new HigiaService(agentData as unknown as AgentDataService);
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_HIGIA_MODEL = 'deepseek/deepseek-v4.1-flash';
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
    if (originalModel === undefined) {
      delete process.env.OPENROUTER_HIGIA_MODEL;
    } else {
      process.env.OPENROUTER_HIGIA_MODEL = originalModel;
    }
  });

  it('reports available when OPENROUTER_API_KEY is set', () => {
    expect(service.getStatus()).toEqual({ available: true });
  });

  it('reports unavailable when OPENROUTER_API_KEY is missing', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(service.getStatus()).toEqual({ available: false });
  });

  it('rejects ask without an API key', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(service.ask('Oi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('runs tool calls then returns the model answer', async () => {
    agentData.getOverview.mockResolvedValue({ patients: { total: 12 } });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'get_clinic_overview',
                        arguments: '{}',
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: 'Ha 12 pacientes cadastrados.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(service.ask('Quantos pacientes temos?')).resolves.toEqual({
      answer: 'Ha 12 pacientes cadastrados.',
    });
    expect(agentData.getOverview).toHaveBeenCalledTimes(1);

    const firstCall = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { body: string },
    ];
    const firstBody = JSON.parse(firstCall[1].body) as {
      messages: Array<{ role: string; content?: string }>;
    };
    const today = todayYmdSaoPaulo();
    expect(firstBody.messages[0]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining(`Hoje e ${today} (America/Sao_Paulo)`),
      }),
    );

    const secondCall = (global.fetch as jest.Mock).mock.calls[1] as [
      string,
      { body: string },
    ];
    const secondBody = JSON.parse(secondCall[1].body) as {
      tools: unknown[];
      model: string;
      messages: Array<{ role: string; name?: string }>;
    };
    expect(secondBody.model).toBe('deepseek/deepseek-v4.1-flash');
    expect(secondBody.tools.length).toBeGreaterThan(0);
    expect(secondBody.messages.some((item) => item.role === 'tool')).toBe(true);
  });

  it('rejects empty model output', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: '   ' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(service.ask('Oi')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects askStream without an API key', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(collectStream(service.askStream('Oi'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('streams tool status then answer deltas', async () => {
    agentData.getOverview.mockResolvedValue({ patients: { total: 12 } });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(sseResponse(toolRoundSse()))
      .mockResolvedValueOnce(sseResponse(answerRoundSse()));

    await expect(
      collectStream(service.askStream('Quantos pacientes temos?')),
    ).resolves.toEqual([
      { type: 'status', message: 'Consultando...' },
      { type: 'delta', text: 'Ha ' },
      { type: 'delta', text: '12 pacientes.' },
      { type: 'done' },
    ]);
    expect(agentData.getOverview).toHaveBeenCalledTimes(1);

    const firstCall = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { body: string },
    ];
    const firstBody = JSON.parse(firstCall[1].body) as { stream: boolean };
    expect(firstBody.stream).toBe(true);
  });
});

function collectStream(
  source: AsyncGenerator<HigiaStreamEvent>,
): Promise<HigiaStreamEvent[]> {
  return (async () => {
    const events: HigiaStreamEvent[] = [];
    for await (const event of source) {
      events.push(event);
    }
    return events;
  })();
}

function sseResponse(payload: string): Response {
  const encoder = new TextEncoder();
  const midpoint = Math.max(1, Math.floor(payload.length / 2));
  const parts = [payload.slice(0, midpoint), payload.slice(midpoint)];
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(encoder.encode(part));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function toolRoundSse(): string {
  return [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_clinic_overview","arguments":""}}]},"finish_reason":null}]}',
    '',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]},"finish_reason":null}]}',
    '',
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
    '',
    'data: [DONE]',
    '',
  ].join('\n');
}

function answerRoundSse(): string {
  return [
    'data: {"choices":[{"delta":{"role":"assistant","content":"Ha "},"finish_reason":null}]}',
    '',
    'data: {"choices":[{"delta":{"content":"12 pacientes."},"finish_reason":null}]}',
    '',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    '',
    'data: [DONE]',
    '',
  ].join('\n');
}

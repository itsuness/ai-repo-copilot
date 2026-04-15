import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test';
import { loadConfig } from '../src/config/index';
import { OpenRouterProvider } from '../src/llm/providers/openrouter';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.OPENROUTER_API_KEY = 'or-api-key';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
  await loadConfig();
});

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockORResponse(body: unknown, ok = true) {
  const fetchMock = mock(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response)
  ) as unknown as typeof fetch;
  fetchMock.preconnect = async () => {};
  global.fetch = fetchMock;
}

// ── OpenRouterProvider.chat() ─────────────────────────────────────────────────

describe('OpenRouterProvider.chat()', () => {
  const provider = new OpenRouterProvider();

  test("returns content and 'stop' finish reason", async () => {
    mockORResponse({
      choices: [
        {
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
    });

    const result = await provider.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello!');
    expect(result.finishReason).toBe('stop');
    expect(result.toolCalls).toBeUndefined();
  });

  test("maps finish_reason 'tool_calls' and parses tool calls", async () => {
    mockORResponse({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'get_repo_tree',
                  arguments: JSON.stringify({ filter: 'src' }),
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });

    const result = await provider.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'list files' }],
    });

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: 'call_1',
      name: 'get_repo_tree',
      arguments: { filter: 'src' },
    });
  });

  test("maps 'length' finish reason to 'length'", async () => {
    mockORResponse({
      choices: [
        {
          message: { role: 'assistant', content: 'cut off...' },
          finish_reason: 'length',
        },
      ],
    });

    const result = await provider.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'long response' }],
    });

    expect(result.finishReason).toBe('length');
  });

  test("maps unknown finish reasons to 'other'", async () => {
    mockORResponse({
      choices: [
        {
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'content_filter',
        },
      ],
    });

    const result = await provider.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'hmm' }],
    });

    expect(result.finishReason).toBe('other');
  });

  test('prepends system message when system param is set', async () => {
    mockORResponse({
      choices: [
        {
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop',
        },
      ],
    });

    await provider.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'hi' }],
      system: 'Be concise.',
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'Be concise.',
    });
  });

  test('sends Authorization header with OpenRouter API key', async () => {
    mockORResponse({
      choices: [
        {
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop',
        },
      ],
    });

    await provider.chat({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'hi' }],
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers['Authorization']).toBe('Bearer or-api-key');
  });

  test('throws on non-ok API response', async () => {
    mockORResponse({ error: 'Internal Server Error' }, false);

    await expect(
      provider.chat({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toThrow('OpenRouter 500');
  });

  test('throws when choices array is empty', async () => {
    mockORResponse({ choices: [] });

    await expect(
      provider.chat({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toThrow('empty response');
  });
});

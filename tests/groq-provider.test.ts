import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test';
import { loadConfig } from '../src/config/index';
import { GroqProvider } from '../src/llm/providers/groq';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'groq-api-key';
  await loadConfig();
});

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockGroqResponse(body: unknown, ok = true) {
  const fetchMock = mock(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 400,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response)
  ) as unknown as typeof fetch;

  fetchMock.preconnect = async () => {};
  global.fetch = fetchMock;
}

// ── GroqProvider.chat() ───────────────────────────────────────────────────────

describe('GroqProvider.chat()', () => {
  const provider = new GroqProvider();

  test("returns content and 'stop' finish reason on normal response", async () => {
    mockGroqResponse({
      choices: [
        {
          message: { content: 'Hello from Groq!', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
    });

    const result = await provider.chat({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello from Groq!');
    expect(result.finishReason).toBe('stop');
    expect(result.toolCalls).toBeUndefined();
  });

  test("maps 'tool_calls' finish reason and parses tool call arguments", async () => {
    mockGroqResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: {
                  name: 'search_repo',
                  arguments: JSON.stringify({ query: 'auth' }),
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });

    const result = await provider.chat({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: 'find auth code' }],
    });

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: 'call_abc',
      name: 'search_repo',
      arguments: { query: 'auth' },
    });
    expect(result.content).toBeNull();
  });

  test("maps unknown finish reason to 'other'", async () => {
    mockGroqResponse({
      choices: [
        {
          message: { content: 'partial...', tool_calls: null },
          finish_reason: 'length',
        },
      ],
    });

    const result = await provider.chat({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: 'tell me everything' }],
    });

    expect(result.finishReason).toBe('other');
  });

  test('includes system message when system param is provided', async () => {
    mockGroqResponse({
      choices: [
        { message: { content: 'ok', tool_calls: null }, finish_reason: 'stop' },
      ],
    });

    await provider.chat({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: 'hi' }],
      system: 'You are a helpful assistant.',
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    });
  });

  test('sends tools in correct OpenAI function-call format', async () => {
    mockGroqResponse({
      choices: [
        { message: { content: 'ok', tool_calls: null }, finish_reason: 'stop' },
      ],
    });

    await provider.chat({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        {
          name: 'search_repo',
          description: 'Search the repo',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.tools).toHaveLength(1);
    expect(body.tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'search_repo',
        description: 'Search the repo',
        parameters: { type: 'object', properties: {} },
      },
    });
    expect(body.tool_choice).toBe('auto');
    expect(body.parallel_tool_calls).toBe(false);
  });

  test('throws on non-ok API response', async () => {
    mockGroqResponse({ error: { message: 'model not found' } }, false);

    await expect(
      provider.chat({
        model: 'bad-model',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toThrow('Groq 400');
  });

  test('converts tool-role messages with toolCallId', async () => {
    mockGroqResponse({
      choices: [
        {
          message: { content: 'done', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
    });

    await provider.chat({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'tool',
          content: 'search results here',
          toolCallId: 'call_xyz',
        },
      ],
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const toolMsg = body.messages[0];

    expect(toolMsg.role).toBe('tool');
    expect(toolMsg.tool_call_id).toBe('call_xyz');
    expect(toolMsg.content).toBe('search results here');
  });
});

import { getConfig } from '../../config';
import type {
  LLMChatParams,
  LLMMessage,
  LLMResponse,
  LLMService,
  LLMTool,
  LLMToolCall,
} from '../types';

// ── OpenRouter wire types (OpenAI-compatible) ─────────────────────────────────

interface ORMessage {
  role: string;
  content: string | null;
  tool_calls?: ORToolCall[];
  tool_call_id?: string;
}

interface ORToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ORTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface ORResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ORToolCall[];
    };
    finish_reason: string | null;
  }>;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class OpenRouterProvider implements LLMService {
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const { openrouterApiKey } = getConfig();

    const messages: ORMessage[] = [
      ...(params.system ? [{ role: 'system', content: params.system }] : []),
      ...params.messages.map(this.toORMessage),
    ];

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      max_tokens: params.maxTokens ?? 8096,
    };

    if (params.tools?.length) {
      body.tools = params.tools.map(this.toORTool);
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ai-repo-copilot',
        'X-Title': 'AI Repo Copilot',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${err}`);
    }

    const data = (await response.json()) as ORResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error('OpenRouter returned an empty response');

    return this.fromORResponse(choice);
  }

  // ── To wire format ──────────────────────────────────────────────────────────

  private toORMessage(msg: LLMMessage): ORMessage {
    return {
      role: msg.role,
      content: msg.content,
      ...(msg.toolCalls && {
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
    };
  }

  private toORTool(tool: LLMTool): ORTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  // ── From wire format ────────────────────────────────────────────────────────

  private fromORResponse(choice: ORResponse['choices'][0]): LLMResponse {
    const toolCalls: LLMToolCall[] | undefined = choice.message.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })
    );

    const finishReason = this.mapFinishReason(choice.finish_reason);

    return {
      content: choice.message.content,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      finishReason,
    };
  }

  private mapFinishReason(raw: string | null): LLMResponse['finishReason'] {
    if (raw === 'stop') return 'stop';
    if (raw === 'tool_calls') return 'tool_calls';
    if (raw === 'length') return 'length';
    return 'other';
  }
}

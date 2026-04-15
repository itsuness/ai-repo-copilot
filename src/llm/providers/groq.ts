import { getConfig } from '../../config';
import type {
  LLMChatParams,
  LLMMessage,
  LLMResponse,
  LLMService,
} from '../types';

function toGroqMessages(messages: LLMMessage[]): object[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: m.content ?? '',
      };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content ?? null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    return { role: m.role, content: m.content ?? '' };
  });
}

export class GroqProvider implements LLMService {
  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const config = getConfig();

    const body: Record<string, unknown> = {
      model: params.model,
      messages: [
        ...(params.system ? [{ role: 'system', content: params.system }] : []),
        ...toGroqMessages(params.messages),
      ],
    };

    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
      body.parallel_tool_calls = false;
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq ${response.status}: ${err}`);
    }

    const data: any = await response.json();
    const message = data.choices?.[0]?.message;
    const finishReason = data.choices?.[0]?.finish_reason ?? 'other';

    const toolCalls = message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: message?.content ?? null,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      finishReason:
        finishReason === 'tool_calls'
          ? 'tool_calls'
          : finishReason === 'stop'
            ? 'stop'
            : 'other',
    };
  }
}

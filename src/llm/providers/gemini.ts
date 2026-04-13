import { getConfig } from '../../config';
import type { LLMChatParams, LLMResponse, LLMService } from '../types';

export class GeminiProvider implements LLMService {
  async chat(params: LLMChatParams): Promise<LLMResponse> {
    const { geminiApiKey } = getConfig();

    const response = await fetch(
      'https://gemini.googleapis.com/v1beta2/models/gemini-1.5-pro-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          input: {
            messages: [
              ...(params.system
                ? [{ role: 'system', content: params.system }]
                : []),
              ...params.messages,
            ],
          },
          maxTokens: params.maxTokens ?? 4096,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`
      );
    }

    const data: any = await response.json();

    return {
      content: data.choices?.[0]?.message?.content ?? null,
      finishReason: data.choices?.[0]?.finish_reason ?? 'other',
    };
  }
}

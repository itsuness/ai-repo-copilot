// ── Provider-agnostic LLM types ───────────────────────────────────────────────
//
// The rest of the codebase only imports from here.
// Providers (OpenRouter, Ollama, …) adapt to and from these shapes internally.

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Populated on assistant messages when the model requested tool calls */
  toolCalls?: LLMToolCall[];
  /** Required on role:'tool' messages — links the result to a tool call */
  toolCallId?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  /** Already-parsed arguments — providers handle JSON serialisation internally */
  arguments: Record<string, unknown>;
}

export interface LLMTool {
  name: string;
  description?: string;
  /** JSON Schema describing the tool's parameters */
  parameters: Record<string, unknown>;
}

export interface LLMChatParams {
  model: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  /** Optional system prompt; prepended as a system message by the provider */
  system?: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: LLMToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'other';
}

/** The contract every provider must satisfy */
export interface LLMService {
  chat(params: LLMChatParams): Promise<LLMResponse>;
}

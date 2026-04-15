// ── LLM Service — single configuration point ──────────────────────────────────
//
// To swap LLM providers, change the import and the instantiation below.
// Nothing else in the codebase needs to change.
//
// Available providers (add more in src/llm/providers/):
//   OpenRouterProvider  →  any model on https://openrouter.ai/models

import { GroqProvider } from './providers/groq';
import { OpenRouterProvider } from './providers/openrouter';
import type { LLMService } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// const provider: LLMService = new OpenRouterProvider();
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
const provider: LLMService = new GroqProvider();
// ─────────────────────────────────────────────────────────────────────────────

export function getLLMService(): LLMService {
  return provider;
}

export type { LLMService } from './types';

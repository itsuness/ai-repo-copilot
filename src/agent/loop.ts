import { logger } from '../utils/logger';
import { createMCPClient } from '../mcp/client';
import { getLLMService } from '../llm/service';
import type { LLMMessage, LLMTool, LLMToolCall } from '../llm/types';
import type { AgentRunOptions } from '../types';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const MAX_ITERATIONS = 10; // safety ceiling — prevents runaway loops

export async function runAgent(options: AgentRunOptions): Promise<string> {
  const { repo, model, systemPrompt, userMessage, allowedTools } = options;

  const llm = getLLMService();
  const mcpClient = await createMCPClient();

  // Fetch tool list from the MCP server via the official SDK
  const { tools: mcpTools } = await mcpClient.listTools();
  const filteredTools = allowedTools
    ? mcpTools.filter((t) => allowedTools.includes(t.name))
    : mcpTools;
  const tools: LLMTool[] = filteredTools.map((t) => ({
    name: t.name,
    description: t.description,
    // Strip `additionalProperties` added by z.looseObject — it serialises as
    // `{}` in Zod v4's JSON schema output and causes Llama/Groq to generate
    // malformed XML-style function calls instead of proper JSON.
    parameters: stripAdditionalProperties(
      t.inputSchema as Record<string, unknown>
    ),
  }));

  logger.debug(
    `Agent starting — model: ${model}, tools: ${tools.map((t) => t.name).join(', ')}`
  );

  const messages: LLMMessage[] = [{ role: 'user', content: userMessage }];

  let iteration = 0;

  // ── Agent loop ────────────────────────────────────────────────────────────
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    logger.debug(`Loop iteration ${iteration}`);

    const response = await llm.chat({
      model,
      messages,
      tools,
      system: systemPrompt,
    });

    logger.debug(`Finish reason: ${response.finishReason}`);

    // Append the assistant turn
    messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // ── Case 1: model is done ─────────────────────────────────────────────
    if (response.finishReason === 'stop' || response.finishReason === 'other') {
      logger.debug('Agent finished after %d iteration(s)', iteration);
      await mcpClient.close();
      return response.content ?? '';
    }

    // ── Case 2: model wants to use tools ──────────────────────────────────
    if (response.finishReason === 'tool_calls' && response.toolCalls?.length) {
      const toolResults = await executeToolCalls(
        response.toolCalls,
        mcpClient,
        repo
      );
      messages.push(...toolResults);
      continue;
    }

    // ── Case 3: length limit or unknown finish reason ────────────────────
    logger.warn(`Stopping loop — finish reason: ${response.finishReason}`);
    await mcpClient.close();
    return response.content ?? '';
  }

  // Exceeded MAX_ITERATIONS
  logger.warn(
    `Agent hit MAX_ITERATIONS (${MAX_ITERATIONS}). Returning partial response.`
  );
  await mcpClient.close();
  const lastAssistant = messages.findLast((m) => m.role === 'assistant');
  return (
    lastAssistant?.content ??
    'Agent reached iteration limit without a final answer.'
  );
}

// ── Schema sanitisation ───────────────────────────────────────────────────────

function stripAdditionalProperties(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const { additionalProperties, ...rest } = schema;
  void additionalProperties; // intentionally removed
  return rest;
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeToolCalls(
  toolCalls: LLMToolCall[],
  mcpClient: Client,
  repo: string
): Promise<LLMMessage[]> {
  const results: LLMMessage[] = [];

  for (const call of toolCalls) {
    logger.debug(`Calling tool: ${call.name}`);

    try {
      // Inject repo so tools never need it passed explicitly
      const args = { ...call.arguments, repo };
      const result = await mcpClient.callTool({
        name: call.name,
        arguments: args,
      });

      if (result.isError) {
        logger.debug(`Tool ${call.name} returned an error`);
      } else {
        logger.debug(`Tool ${call.name} succeeded`);
      }

      // Extract text from MCP content blocks
      const blocks = result.content as Array<{ type: string; text?: string }>;
      const text = blocks
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n');

      results.push({
        role: 'tool',
        toolCallId: call.id,
        content: text,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`Tool ${call.name} failed: ${msg}`);

      results.push({
        role: 'tool',
        toolCallId: call.id,
        content: `Error: ${msg}`,
      });
    }
  }

  return results;
}

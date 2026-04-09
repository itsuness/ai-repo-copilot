import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config';
import { logger } from '../utils/logger';
import { createMCPClient } from '../mcp/client';
import type { AgentRunOptions } from '../types';

const MAX_ITERATIONS = 10; // safety ceiling — prevents runaway loops

export async function runAgent(options: AgentRunOptions): Promise<string> {
  const { repo, model, systemPrompt, userMessage } = options;
  const config = getConfig();

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const mcpClient = await createMCPClient();

  // Fetch tools, resources, and prompts registered on the MCP server
  const mcpTools = await mcpClient.listTools();
  const tools = mcpTools.map(convertToAnthropicTool);

  logger.debug(
    `Agent starting — model: ${model}, tools: ${tools.map((t) => t.name).join(', ')}`
  );

  // Seed the conversation
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  let iteration = 0;

  // ── Agent loop ────────────────────────────────────────────────────────────
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    logger.debug(`Loop iteration ${iteration}`);

    const response = await anthropic.messages.create({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      tools,
      messages,
    });

    logger.debug(`Stop reason: ${response.stop_reason}`);

    // Append the assistant turn (may contain text + tool_use blocks)
    messages.push({ role: 'assistant', content: response.content });

    // ── Case 1: model is done ─────────────────────────────────────────────
    if (response.stop_reason === 'end_turn') {
      const finalText = extractText(response.content);
      logger.debug('Agent finished after %d iteration(s)', iteration);
      await mcpClient.close();
      return finalText;
    }

    // ── Case 2: model wants to use tools ──────────────────────────────────
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Execute every requested tool call (can be multiple in one turn)
      const toolResults = await executeToolCalls(
        toolUseBlocks,
        mcpClient,
        repo
      );

      // Feed results back as a user turn
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // ── Case 3: unexpected stop reason ───────────────────────────────────
    logger.warn(
      `Unexpected stop_reason: ${response.stop_reason}. Ending loop.`
    );
    await mcpClient.close();
    return extractText(response.content);
  }

  // Exceeded MAX_ITERATIONS — return whatever we have
  logger.warn(
    `Agent hit MAX_ITERATIONS (${MAX_ITERATIONS}). Returning partial response.`
  );
  await mcpClient.close();
  const lastAssistant = messages.findLast((m) => m.role === 'assistant');
  if (lastAssistant && Array.isArray(lastAssistant.content)) {
    return extractText(lastAssistant.content);
  }
  return 'Agent reached iteration limit without a final answer.';
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeToolCalls(
  toolUseBlocks: Anthropic.ToolUseBlock[],
  mcpClient: Awaited<ReturnType<typeof createMCPClient>>,
  repo: string
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = [];

  for (const block of toolUseBlocks) {
    logger.debug(`Calling tool: ${block.name}`, block.input);

    try {
      // Inject repo into every tool call so tools never need it passed explicitly
      const input = { ...(block.input as Record<string, unknown>), repo };
      const result = await mcpClient.callTool(block.name, input);

      logger.debug(`Tool ${block.name} succeeded`);

      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content:
          typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.debug(`Tool ${block.name} failed: ${message}`);

      // Return the error as a tool_result — the model can decide how to recover
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Error: ${message}`,
        is_error: true,
      });
    }
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function convertToAnthropicTool(mcpTool: {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}): Anthropic.Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description ?? '',
    input_schema: mcpTool.inputSchema as Anthropic.Tool['input_schema'],
  };
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { searchRepoTool } from './tools/search_repo';
import { commentOnPrTool } from './tools/comment_on_pr';
import { createIssueTool } from './tools/create_issue';
import { runTestsTool } from './tools/run_tests';
import { readFileChunkTool } from './tools/read_file_chunk';
import { getRepoTreeTool } from './tools/get_repo_tree';
import { getPrDiffTool } from './tools/get_pr_diff';
import { filesResource } from './resources/files';
import { issuesResource } from './resources/issues';

// z.looseObject (Zod v4) allows extra keys like `repo`, which the agent loop
// injects at call time, to pass through without appearing in the LLM-visible schema.

export function createMCPServer(): McpServer {
  const server = new McpServer({ name: 'repo-copilot', version: '1.0.0' });

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.registerTool(
    getPrDiffTool.name,
    {
      description: getPrDiffTool.description,
      inputSchema: z.looseObject({
        pr_number: z.number().describe('The pull request number'),
      }),
    },
    async (args) => {
      const text = await getPrDiffTool.handler(
        args as Parameters<typeof getPrDiffTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    getRepoTreeTool.name,
    {
      description: getRepoTreeTool.description,
      inputSchema: z.looseObject({
        filter: z
          .string()
          .describe('Optional substring to filter paths')
          .optional(),
      }),
    },
    async (args) => {
      const text = await getRepoTreeTool.handler(
        args as Parameters<typeof getRepoTreeTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    searchRepoTool.name,
    {
      description: searchRepoTool.description,
      inputSchema: z.looseObject({
        query: z
          .string()
          .describe(
            'Search query (e.g. "authentication function", filename, symbol name)'
          ),
      }),
    },
    async (args) => {
      const text = await searchRepoTool.handler(
        args as Parameters<typeof searchRepoTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text: String(text) }] };
    }
  );

  server.registerTool(
    readFileChunkTool.name,
    {
      description: readFileChunkTool.description,
      inputSchema: z.looseObject({
        path: z
          .string()
          .describe('File path within the repository (e.g. src/auth.ts)'),
        start_line: z
          .number()
          .describe('First line to read, 1-indexed (inclusive)'),
        end_line: z
          .number()
          .describe('Last line to read, 1-indexed (inclusive)'),
        ref: z
          .string()
          .describe('Branch, tag, or commit SHA (defaults to default branch)')
          .optional(),
      }),
    },
    async (args) => {
      const text = await readFileChunkTool.handler(
        args as Parameters<typeof readFileChunkTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    filesResource.name,
    {
      description: filesResource.description,
      inputSchema: z.looseObject({
        path: z
          .string()
          .describe('File path within the repository (e.g. src/auth.ts)'),
        ref: z
          .string()
          .describe(
            'Branch, tag, or commit SHA (defaults to the default branch)'
          )
          .optional(),
      }),
    },
    async (args) => {
      const text = await filesResource.handler(
        args as Parameters<typeof filesResource.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    issuesResource.name,
    {
      description: issuesResource.description,
      inputSchema: z.looseObject({
        state: z
          .enum(['open', 'closed', 'all'])
          .describe('Filter by issue state (default: open)')
          .optional(),
      }),
    },
    async (args) => {
      const text = await issuesResource.handler(
        args as Parameters<typeof issuesResource.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    commentOnPrTool.name,
    {
      description: commentOnPrTool.description,
      inputSchema: z.looseObject({
        pr_number: z.number().describe('The pull request number'),
        body: z.string().describe('Comment text (markdown supported)'),
      }),
    },
    async (args) => {
      const text = await commentOnPrTool.handler(
        args as Parameters<typeof commentOnPrTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    createIssueTool.name,
    {
      description: createIssueTool.description,
      inputSchema: z.looseObject({
        title: z.string().describe('Issue title'),
        body: z
          .string()
          .describe('Issue body/description (markdown supported)'),
        labels: z
          .array(z.string())
          .describe('Labels to apply to the issue (optional)')
          .optional(),
      }),
    },
    async (args) => {
      const text = await createIssueTool.handler(
        args as Parameters<typeof createIssueTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  server.registerTool(
    runTestsTool.name,
    {
      description: runTestsTool.description,
      inputSchema: z.looseObject({
        path: z
          .string()
          .describe(
            'Local directory to run tests in (defaults to current working directory)'
          )
          .optional(),
        command: z
          .string()
          .describe('Test command to run (defaults to "bun test")')
          .optional(),
      }),
    },
    async (args) => {
      const text = await runTestsTool.handler(
        args as Parameters<typeof runTestsTool.handler>[0]
      );
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  return server;
}

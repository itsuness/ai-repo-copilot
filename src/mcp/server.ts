import { searchRepoTool } from './tools/search_repo';
import { commentOnPrTool } from './tools/comment_on_pr';
import { createIssueTool } from './tools/create_issue';
import { runTestsTool } from './tools/run_tests';
import { readFileChunkTool } from './tools/read_file_chunk';
import { getRepoTreeTool } from './tools/get_repo_tree';
import { filesResource } from './resources/files';
import { commitsResource } from './resources/commits';
import { issuesResource } from './resources/issues';
import { explainCodePrompt } from './prompts/explain_code';
import { generateTestsPrompt } from './prompts/generate_tests';
import { reviewPrPrompt } from './prompts/review_pr';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (input: any) => Promise<unknown>;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  template: string;
}

// All tools exposed to the Claude agent (tools + resources are both callable)
const TOOLS: MCPTool[] = [
  getRepoTreeTool,
  searchRepoTool,
  readFileChunkTool,
  filesResource,
  commitsResource,
  issuesResource,
  commentOnPrTool,
  createIssueTool,
  runTestsTool,
];

const PROMPTS: MCPPrompt[] = [
  explainCodePrompt,
  generateTestsPrompt,
  reviewPrPrompt,
];

export class MCPServer {
  listTools(): MCPTool[] {
    return TOOLS;
  }

  getPrompt(name: string): MCPPrompt | undefined {
    return PROMPTS.find((p) => p.name === name);
  }

  async callTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) {
      throw new Error(
        `Unknown tool: "${name}". Available tools: ${TOOLS.map((t) => t.name).join(', ')}`
      );
    }
    return tool.handler(input);
  }
}

export function createMCPServer(): MCPServer {
  return new MCPServer();
}

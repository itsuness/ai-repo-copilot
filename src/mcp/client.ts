import { createMCPServer } from './server';

export interface MCPClient {
  listTools(): Promise<
    Array<{
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>
  >;
  callTool(name: string, input: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export async function createMCPClient(): Promise<MCPClient> {
  const server = createMCPServer();

  return {
    async listTools() {
      return server.listTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    },

    async callTool(name: string, input: Record<string, unknown>) {
      return server.callTool(name, input);
    },

    async close() {
      // In-process server — nothing to tear down
    },
  };
}

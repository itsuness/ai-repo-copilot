import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMCPServer } from './server';

export async function createMCPClient(): Promise<Client> {
  const server = createMCPServer();
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: 'repo-copilot-agent', version: '1.0.0' });
  await client.connect(clientTransport);

  return client;
}

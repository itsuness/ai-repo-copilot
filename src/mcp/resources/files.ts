import { getFileContent } from '../../github/client';

export const filesResource = {
  name: 'read_file',
  description:
    'Read the ENTIRE content of a file. Only use this when you genuinely need the full file (e.g. generating tests, explaining a whole module). For answering questions or finding bugs, prefer read_file_chunk with the specific line range from search results.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'File path within the repository (e.g. src/auth.ts)',
      },
      ref: {
        type: 'string',
        description:
          'Branch, tag, or commit SHA (defaults to the default branch)',
      },
    },
    required: ['path'],
  },
  async handler(input: {
    path: string;
    ref?: string;
    repo: string;
  }): Promise<string> {
    const content = await getFileContent(input.repo, input.path, input.ref);
    return `// ${input.path}\n${content}`;
  },
};

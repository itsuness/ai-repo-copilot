import { getFileContent } from '../../github/client';

export const filesResource = {
  name: 'read_file',
  description:
    'Read the content of a file from the GitHub repository. Use this to inspect source code before explaining or reviewing it.',
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

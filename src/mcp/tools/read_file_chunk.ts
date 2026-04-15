import { getFileContent } from '../../github/client';

export const readFileChunkTool = {
  name: 'read_file_chunk',
  description:
    'Read a specific range of lines from a file. Prefer this over read_file when search results already point to a section — avoids pulling the whole file.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'File path within the repository (e.g. src/auth.ts)',
      },
      start_line: {
        type: 'number',
        description: 'First line to read, 1-indexed (inclusive)',
      },
      end_line: {
        type: 'number',
        description: 'Last line to read, 1-indexed (inclusive)',
      },
      ref: {
        type: 'string',
        description: 'Branch, tag, or commit SHA (defaults to default branch)',
      },
    },
    required: ['path', 'start_line', 'end_line'],
  },
  async handler(input: {
    path: string;
    start_line: number;
    end_line: number;
    ref?: string;
    repo: string;
  }): Promise<string> {
    const content = await getFileContent(input.repo, input.path, input.ref);
    const lines = content.split('\n');
    const total = lines.length;

    const start = Math.max(1, input.start_line);
    const end = Math.min(total, input.end_line);

    const slice = lines.slice(start - 1, end);
    const numbered = slice.map((line, i) => `${start + i}: ${line}`).join('\n');

    return `// ${input.path} (lines ${start}–${end} of ${total})\n${numbered}`;
  },
};

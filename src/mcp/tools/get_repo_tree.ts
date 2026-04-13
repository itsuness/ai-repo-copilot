import { getRepoTree } from '../../github/client';

export const getRepoTreeTool = {
  name: 'get_repo_tree',
  description:
    'List all source files in the repository as a flat path tree. Use this to understand repo structure before searching or reading files.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      filter: {
        type: 'string',
        description:
          'Optional substring to filter paths (e.g. "src/auth" returns only paths containing that string)',
      },
    },
    required: [],
  },
  async handler(input: { filter?: string; repo: string }): Promise<string> {
    const paths = await getRepoTree(input.repo);

    const filtered = input.filter
      ? paths.filter((p) => p.includes(input.filter!))
      : paths;

    if (filtered.length === 0) {
      return input.filter
        ? `No files matching "${input.filter}" found in ${input.repo}`
        : `No source files found in ${input.repo}`;
    }

    return `${filtered.length} file(s) in ${input.repo}${input.filter ? ` matching "${input.filter}"` : ''}:\n\n${filtered.join('\n')}`;
  },
};

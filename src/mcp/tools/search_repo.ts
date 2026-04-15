import { searchCode } from '../../github/client';

export const searchRepoTool = {
  name: 'search_repo',
  description:
    'Search for code, files, or symbols in the GitHub repository. Returns matching file paths with relevant snippets.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Search query (e.g. "authentication function", filename, symbol name)',
      },
    },
    required: ['query'],
  },
  async handler(input: { query: string; repo: string }): Promise<string> {
    const results = (await searchCode(input.repo, input.query)) as {
      total_count: number;
      items: Array<{
        path: string;
        html_url: string;
        text_matches?: Array<{ fragment: string }>;
      }>;
    };

    if (!results.items || results.items.length === 0) {
      return `No results found for "${input.query}" in ${input.repo}`;
    }

    const formatted = results.items
      .map((item) => {
        const snippets =
          item.text_matches
            ?.map((m) => `  ...${m.fragment.trim()}...`)
            .join('\n') ?? '';
        return snippets ? `${item.path}\n${snippets}` : item.path;
      })
      .join('\n\n');

    return `Found ${results.total_count} results (showing ${results.items.length}):\n\n${formatted}`;
  },
};

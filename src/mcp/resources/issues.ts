import { getIssues } from '../../github/client';

export const issuesResource = {
  name: 'list_issues',
  description:
    'List GitHub issues from the repository, optionally filtered by state.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      state: {
        type: 'string',
        enum: ['open', 'closed', 'all'],
        description: 'Filter by issue state (default: open)',
      },
    },
    required: [],
  },
  async handler(input: {
    state?: 'open' | 'closed' | 'all';
    repo: string;
  }): Promise<string> {
    const state = input.state ?? 'open';
    const issues = (await getIssues(input.repo, state)) as Array<{
      number: number;
      title: string;
      state: string;
      user: { login: string };
      labels: Array<{ name: string }>;
      html_url: string;
    }>;

    if (issues.length === 0) {
      return `No ${state} issues found in ${input.repo}`;
    }

    const formatted = issues
      .map((issue) => {
        const labels = issue.labels.map((l) => l.name).join(', ') || 'none';
        return [
          `#${issue.number}: ${issue.title}`,
          `  State: ${issue.state}  Author: ${issue.user.login}  Labels: ${labels}`,
          `  ${issue.html_url}`,
        ].join('\n');
      })
      .join('\n\n');

    return `Issues in ${input.repo} (${state}):\n\n${formatted}`;
  },
};

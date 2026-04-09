import { createIssue } from '../../github/client';

export const createIssueTool = {
  name: 'create_issue',
  description: 'Create a new GitHub issue in the repository.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Issue title',
      },
      body: {
        type: 'string',
        description: 'Issue body/description (markdown supported)',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to apply to the issue (optional)',
      },
    },
    required: ['title', 'body'],
  },
  async handler(input: {
    title: string;
    body: string;
    labels?: string[];
    repo: string;
  }): Promise<string> {
    const issue = (await createIssue(
      input.repo,
      input.title,
      input.body,
      input.labels
    )) as { html_url: string; number: number };
    return `Issue created: ${issue.html_url} (#${issue.number})`;
  },
};

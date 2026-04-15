import { commentOnPR } from '../../github/client';

export const commentOnPrTool = {
  name: 'comment_on_pr',
  description: 'Post a comment on a GitHub pull request.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pr_number: {
        type: 'number',
        description: 'The pull request number',
      },
      body: {
        type: 'string',
        description: 'Comment text (markdown supported)',
      },
    },
    required: ['pr_number', 'body'],
  },
  async handler(input: {
    pr_number: number;
    body: string;
    repo: string;
  }): Promise<string> {
    const comment = (await commentOnPR(
      input.repo,
      input.pr_number,
      input.body
    )) as {
      html_url: string;
      id: number;
    };
    return `Comment posted: ${comment.html_url}`;
  },
};

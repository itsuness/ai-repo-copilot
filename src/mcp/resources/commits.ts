import { getPR, getPRFiles, getPRDiff } from '../../github/client';

export const commitsResource = {
  name: 'get_pr_diff',
  description:
    'Get the full diff, metadata, and list of changed files for a GitHub pull request.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pr_number: {
        type: 'number',
        description: 'The pull request number',
      },
    },
    required: ['pr_number'],
  },
  async handler(input: { pr_number: number; repo: string }): Promise<string> {
    const [pr, files, diff] = await Promise.all([
      getPR(input.repo, input.pr_number),
      getPRFiles(input.repo, input.pr_number),
      getPRDiff(input.repo, input.pr_number),
    ]);

    const prData = pr as {
      title: string;
      user: { login: string };
      base: { ref: string };
      head: { ref: string };
      additions: number;
      deletions: number;
    };
    const filesData = files as Array<{ status: string; filename: string }>;

    const header = [
      `PR #${input.pr_number}: ${prData.title}`,
      `Author: ${prData.user.login}`,
      `${prData.base.ref} ← ${prData.head.ref}`,
      `Files changed: ${filesData.length}  (+${prData.additions} / -${prData.deletions})`,
      '',
      'Changed files:',
      ...filesData.map((f) => `  ${f.status.padEnd(9)} ${f.filename}`),
      '',
      '--- diff ---',
    ].join('\n');

    // Truncate very large diffs so we don't blow the context window
    const truncatedDiff =
      diff.length > 8000
        ? diff.slice(0, 8000) + '\n... (diff truncated)'
        : diff;

    return `${header}\n${truncatedDiff}`;
  },
};

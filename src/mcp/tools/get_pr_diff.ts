import { getPR, getPRDiff, getPRFiles } from '../../github/client';

export const getPrDiffTool = {
  name: 'get_pr_diff',
  description:
    'Fetch a pull request title, description, changed file list, and full unified diff.',
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

    const meta = pr as {
      title: string;
      body: string | null;
      user: { login: string };
      head: { ref: string };
      base: { ref: string };
    };

    const changedFiles = (
      files as Array<{ filename: string; status: string; changes: number }>
    )
      .map((f) => `  ${f.status.padEnd(8)} ${f.filename} (+${f.changes})`)
      .join('\n');

    return [
      `PR #${input.pr_number}: ${meta.title}`,
      `Author: ${meta.user.login}  |  ${meta.head.ref} → ${meta.base.ref}`,
      `\nDescription:\n${meta.body ?? '(none)'}`,
      `\nChanged files:\n${changedFiles}`,
      `\nDiff:\n${diff}`,
    ].join('\n');
  },
};

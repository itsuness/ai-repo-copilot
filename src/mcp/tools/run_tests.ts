import { spawnSync } from 'child_process';

export const runTestsTool = {
  name: 'run_tests',
  description:
    'Run the test suite in a local directory. Returns exit code and output. Useful for verifying generated tests.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description:
          'Local directory to run tests in (defaults to current working directory)',
      },
      command: {
        type: 'string',
        description: 'Test command to run (defaults to "bun test")',
      },
    },
    required: [],
  },
  async handler(input: {
    path?: string;
    command?: string;
    repo: string;
  }): Promise<string> {
    const cwd = input.path ?? process.cwd();
    const cmd = input.command ?? 'bun test';
    const [bin = 'bun', ...args] = cmd.split(' ');

    const result = spawnSync(bin, args, {
      cwd,
      encoding: 'utf-8',
      timeout: 60_000,
    });

    if (result.error) {
      return `Failed to run "${cmd}": ${result.error.message}`;
    }

    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();
    return `Exit code: ${result.status}\n\n${output || '(no output)'}`;
  },
};

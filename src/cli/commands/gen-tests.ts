import { Command } from 'commander';
import { resolveContext } from '../../types';
import { runAgent } from '../../agent/loop';
import { Spinner } from '../../utils/spinner';
import { logger } from '../../utils/logger';

export function genTestsCommand(): Command {
  return new Command('gen-tests')
    .description('Generate tests for a file or function')
    .argument('<path>', 'File path to generate tests for')
    .option('--repo <owner/repo>', 'GitHub repository (overrides global)')
    .option(
      '--framework <name>',
      'Test framework to use (bun|jest|vitest)',
      'bun'
    )
    .option('--output <path>', 'Write generated tests to this file path')
    .action(async (filePath: string, opts, cmd) => {
      const globals = cmd.optsWithGlobals();
      const { repo, model } = resolveContext(globals, opts);

      const spinner = new Spinner(
        `Generating tests for ${filePath}...`
      ).start();

      try {
        const tests = await runAgent({
          repo,
          model,
          systemPrompt: `You are a test engineer for the repository ${repo}.
Use the generate_tests prompt. Read the target file and any existing tests via resources.
Generate comprehensive tests using ${opts.framework}. Cover: happy paths, edge cases, error handling.
Output ONLY valid test code with no explanation — the output will be written directly to a file.`,
          userMessage: `Generate ${opts.framework} tests for ${filePath} in ${repo}.`,
        });

        spinner.succeed('Tests generated');

        if (opts.output) {
          await Bun.write(opts.output, tests);
          logger.success(`Written to ${opts.output}`);
        } else {
          logger.print('\n' + tests);
        }
      } catch (err) {
        spinner.fail('Generation failed');
        throw err;
      }
    });
}

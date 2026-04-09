import { Command } from 'commander';
import { resolveContext } from '../../types';
import { runAgent } from '../../agent/loop';
import { Spinner } from '../../utils/spinner';
import { logger } from '../../utils/logger';

export function explainCommand(): Command {
  return new Command('explain')
    .description('Explain a file, directory, or function')
    .argument('<path>', 'File or directory path within the repo')
    .option('--repo <owner/repo>', 'GitHub repository (overrides global)')
    .option('--depth <level>', 'Explanation depth (brief|detailed)', 'detailed')
    .action(async (filePath: string, opts, cmd) => {
      const globals = cmd.optsWithGlobals();
      const { repo, model } = resolveContext(globals, opts);

      const spinner = new Spinner(`Reading ${filePath}...`).start();

      try {
        const explanation = await runAgent({
          repo,
          model,
          systemPrompt: `You are an expert at reading and explaining code for the repository ${repo}.
Use the explain_code prompt. Read the file via repo://files/${repo}/${filePath} and any related files.
Explanation depth: ${opts.depth}. Cover: purpose, key abstractions, data flow, and important edge cases.`,
          userMessage: `Explain ${filePath} in ${repo}.`,
        });

        spinner.succeed('Done');
        logger.print('\n' + explanation);
      } catch (err) {
        spinner.fail('Failed');
        throw err;
      }
    });
}

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

To gather context:
1. Use read_file to read the target file (full content is appropriate here).
2. Use search_repo or read_file_chunk to look up related files only when needed to clarify a dependency or abstraction.
3. Use get_repo_tree (with a filter) if you need to understand where the file fits in the overall structure.

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

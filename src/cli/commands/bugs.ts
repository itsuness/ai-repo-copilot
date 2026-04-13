import { Command } from 'commander';
import { resolveContext } from '../../types';
import { runAgent } from '../../agent/loop';
import { Spinner } from '../../utils/spinner';
import { logger } from '../../utils/logger';

export function bugsCommand(): Command {
  return new Command('bugs')
    .description('Find potential bugs in a file or directory')
    .argument('<path>', 'File or directory path to analyse')
    .option('--repo <owner/repo>', 'GitHub repository (overrides global)')
    .option(
      '--severity <level>',
      'Minimum severity to report (low|medium|high)',
      'low'
    )
    .action(async (filePath: string, opts, cmd) => {
      const globals = cmd.optsWithGlobals();
      const { repo, model } = resolveContext(globals, opts);

      const spinner = new Spinner(`Scanning ${filePath} for bugs...`).start();

      try {
        const report = await runAgent({
          repo,
          model,
          systemPrompt: `You are a security and correctness expert analysing code in ${repo}.

To gather context:
1. Use search_repo to locate the target code and related callers.
2. Use read_file_chunk to read only the relevant sections (focus around the lines from snippets).
3. Only use read_file for the specific file under analysis if you need its full content.

Report bugs in this format per issue:
  [SEVERITY] Title
  File: path:line
  Problem: description
  Fix: recommended change
Only report issues with severity >= ${opts.severity}.`,
          userMessage: `Find bugs in ${filePath} in the repository ${repo}.`,
        });

        spinner.succeed('Scan complete');
        logger.print('\n' + report);
      } catch (err) {
        spinner.fail('Scan failed');
        throw err;
      }
    });
}

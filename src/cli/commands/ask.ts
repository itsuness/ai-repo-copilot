import { Command } from 'commander';
import { resolveContext } from '../../types';
// import { runAgent } from '../agent/loop';
import { Spinner } from '../../utils/spinner';
import { logger } from '../../utils/logger';
import { runAgent } from '../../agent/loop';

export function askCommand(): Command {
  return new Command('ask')
    .description('Ask a question about the repository')
    .argument('<question>', 'The question to ask')
    .option('--repo <owner/repo>', 'GitHub repository (overrides global)')
    .action(async (question: string, opts, cmd) => {
      const globals = cmd.optsWithGlobals();
      const { repo, model } = resolveContext(globals, opts);

      const spinner = new Spinner('Thinking...').start();

      try {
        const answer = await runAgent({
          repo,
          model,
          systemPrompt: `You are an expert code assistant for the GitHub repository ${repo}.
            Use the search_repo tool to find relevant files, then read their contents via resources.
            Be concise and cite specific files and line numbers where relevant.`,
          userMessage: question,
        });

        spinner.succeed('Done');
        logger.print('\n' + answer);
      } catch (err) {
        spinner.fail('Failed');
        throw err;
      }
    });
}

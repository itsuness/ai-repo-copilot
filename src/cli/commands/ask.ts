import { Command } from 'commander';
import { resolveContext } from '../../types';
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

            Follow this order when answering — stop as soon as you have enough context:
            1. Use search_repo: the returned snippets are often sufficient to answer directly.
            2. If you need a bit more context, use read_file_chunk with the specific line range from the snippet.
            3. Use get_repo_tree (with a filter) to understand structure when the question is about the repo layout.
            4. Only use read_file as a last resort when you genuinely need the full file.

            Be concise. Cite specific files and line numbers.`,
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

import { Command } from 'commander';
import { resolveContext } from '../../types';
import { runAgent } from '../../agent/loop';
import { Spinner } from '../../utils/spinner';
import { logger } from '../../utils/logger';

export function reviewCommand(): Command {
  return new Command('review')
    .description('Review a pull request')
    .requiredOption('--pr <number>', 'Pull request number', parseInt)
    .option('--repo <owner/repo>', 'GitHub repository (overrides global)')
    .option(
      '--focus <area>',
      'Area to focus on (security|performance|correctness)'
    )
    .action(async (opts, cmd) => {
      const globals = cmd.optsWithGlobals();
      const { repo, model } = resolveContext(globals, opts);
      const focus = opts.focus ? `Focus especially on ${opts.focus}.` : '';

      const spinner = new Spinner(`Reviewing PR #${opts.pr}...`).start();

      try {
        const review = await runAgent({
          repo,
          model,
          systemPrompt: `You are a senior engineer performing a thorough code review for ${repo}.
Use the review_pr prompt, read changed files via resources, and comment_on_pr if issues are found.
Structure your review with: Summary, Issues (critical/minor), Suggestions, and Verdict. ${focus}`,
          userMessage: `Please review pull request #${opts.pr} in ${repo}.`,
        });

        spinner.succeed('Review complete');
        logger.print('\n' + review);
      } catch (err) {
        spinner.fail('Review failed');
        throw err;
      }
    });
}

#!/usr/bin/env bun

import { Command } from 'commander';
import { askCommand } from './cli/commands/ask';
import { reviewCommand } from './cli/commands/review';
import { explainCommand } from './cli/commands/explain';
import { bugsCommand } from './cli/commands/bugs';
import { genTestsCommand } from './cli/commands/gen-tests';
import { loadConfig } from './config';
import { logger } from './utils/logger';

async function main() {
  await loadConfig();

  const program = new Command();

  program
    .name('repo-copilot')
    .description('AI-powered code reviewer and repo assistant')
    .version('1.0.0')
    .option(
      '--repo <owner/repo>',
      'GitHub repository (e.g. acme/api)',
      process.env.DEFAULT_REPO
    )
    .option(
      '--model <model>',
      'OpenRouter model ID to use',
      'anthropic/claude-sonnet-4-5'
    )
    .option('--debug', 'Enable debug logging', false);

  program.addCommand(askCommand());
  program.addCommand(reviewCommand());
  program.addCommand(explainCommand());
  program.addCommand(bugsCommand());
  program.addCommand(genTestsCommand());

  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.debug) {
      logger.setLevel('debug');
    }
    if (!opts.repo) {
      logger.warn('No --repo specified. Some commands may not work correctly.');
    }
  });

  program.addHelpText(
    'after',
    `
Examples:
  $ repo-copilot ask --repo acme/api "How does auth work?"
  $ repo-copilot review --repo acme/api --pr 42
  $ repo-copilot explain --repo acme/api src/auth.ts
  $ repo-copilot bugs --repo acme/api src/payments/
  $ repo-copilot gen-tests --repo acme/api src/utils/jwt.ts
`
  );

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

export interface GlobalOptions {
  repo?: string;
  model: string;
  debug: boolean;
}

export interface AgentRunOptions {
  repo: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  /** Restrict the agent to this subset of tool names. Defaults to all tools. */
  allowedTools?: string[];
}

export interface CommandContext {
  repo: string;
  model: string;
}

export function resolveContext(
  opts: GlobalOptions & { repo?: string },
  commandOpts: { repo?: string }
): CommandContext {
  const repo = commandOpts.repo ?? opts.repo;
  if (!repo) {
    throw new Error(
      'No repository specified. Use --repo owner/name or set DEFAULT_REPO in .env'
    );
  }
  return { repo, model: opts.model };
}

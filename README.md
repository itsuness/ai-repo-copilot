# AI Repo Copilot

An AI-powered CLI assistant for GitHub repositories. Ask questions about your code, review pull requests, explain files, find bugs, and generate tests — all from the terminal using a tool-calling agent backed by your choice of LLM provider.

## Features

| Command | What it does |
|---|---|
| `ask` | Answer natural-language questions about the codebase |
| `review` | Perform a structured code review on a pull request |
| `explain` | Explain a file, directory, or module in depth |
| `bugs` | Scan a path for potential bugs and security issues |
| `gen-tests` | Generate a test suite for a file |

## Requirements

- [Bun](https://bun.sh) >= 1.0
- A GitHub personal access token
- An API key for at least one supported LLM provider (Groq or OpenRouter)

## Installation

```bash
git clone https://github.com/your-org/ai-repo-copilot
cd ai-repo-copilot
bun install
```

## Configuration

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub personal access token (`repo` and `read:org` scopes) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `GROQ_API_KEY` | Yes | Groq API key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (can be a placeholder if unused) |
| `DEFAULT_REPO` | No | Default repository in `owner/repo` format — avoids typing `--repo` every time |
| `DEFAULT_MODEL` | No | Default model ID (defaults to `claude-sonnet-4-5`) |
| `LOG_LEVEL` | No | Verbosity: `debug`, `info`, `warn`, `error` (defaults to `info`) |

## Usage

```
repo-copilot [--repo <owner/repo>] [--model <model-id>] [--debug] <command> [options]
```

The `--repo` flag is global and can be set once via `DEFAULT_REPO` in `.env`.

---

### ask

Ask any natural-language question about the repository.

```bash
repo-copilot ask --repo acme/api "How does authentication work?"
repo-copilot ask --repo acme/api "Where is the rate limiter configured?"
repo-copilot ask --repo acme/api "What does the payment processor return on failure?"
```

---

### review

Review a pull request. The agent fetches the diff, examines changed code in context, and posts a structured comment directly on the PR.

```bash
repo-copilot review --repo acme/api --pr 42
repo-copilot review --repo acme/api --pr 42 --focus security
repo-copilot review --repo acme/api --pr 42 --focus performance
```

| Flag | Description |
|---|---|
| `--pr <number>` | Pull request number (required) |
| `--focus <area>` | Focus area: `security`, `performance`, or `correctness` |

The review is structured as: **Summary → Issues (critical/minor) → Suggestions → Verdict**.

---

### explain

Explain a file or directory. The agent reads the code and produces a breakdown covering purpose, key abstractions, data flow, and edge cases.

```bash
repo-copilot explain --repo acme/api src/auth/middleware.ts
repo-copilot explain --repo acme/api src/payments/ --depth brief
```

| Flag | Description |
|---|---|
| `--depth <level>` | `brief` or `detailed` (default: `detailed`) |

---

### bugs

Scan a file or directory for potential bugs, security issues, and correctness problems.

```bash
repo-copilot bugs --repo acme/api src/payments/
repo-copilot bugs --repo acme/api src/auth.ts --severity high
```

Each finding is reported in a structured format:

```
[HIGH] SQL injection in user search
File: src/users/search.ts:42
Problem: User input is interpolated directly into the query string.
Fix: Use parameterised queries via the ORM's where() helper.
```

| Flag | Description |
|---|---|
| `--severity <level>` | Minimum severity to report: `low`, `medium`, or `high` (default: `low`) |

---

### gen-tests

Generate a test suite for a file. The agent reads the source, matches the style of any existing tests, and outputs complete, runnable test code.

```bash
repo-copilot gen-tests --repo acme/api src/utils/jwt.ts
repo-copilot gen-tests --repo acme/api src/utils/jwt.ts --framework vitest --output tests/jwt.test.ts
```

| Flag | Description |
|---|---|
| `--framework <name>` | Test framework: `bun`, `jest`, or `vitest` (default: `bun`) |
| `--output <path>` | Write generated tests to this local file instead of printing to stdout |

---

## Switching LLM Providers

The active provider is set in [src/llm/service.ts](src/llm/service.ts):

```ts
// Groq (default)
const provider: LLMService = new GroqProvider();

// OpenRouter — gives access to Claude, GPT-4o, Gemini, and more
// const provider: LLMService = new OpenRouterProvider();
```

Swap the commented line and restart. The `--model` flag specifies which model to request; valid IDs depend on the active provider.

**Groq examples:** `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`

**OpenRouter examples:** `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`, `google/gemini-2.5-pro`

---

## Architecture

```
src/
├── index.ts                  CLI entry point (Commander.js)
├── config/index.ts           Env var loading and validation
├── types/index.ts            Shared TypeScript interfaces
│
├── cli/commands/             One file per subcommand
│   ├── ask.ts
│   ├── review.ts
│   ├── explain.ts
│   ├── bugs.ts
│   └── gen-tests.ts
│
├── agent/loop.ts             Agentic loop — LLM ↔ tools, max 10 iterations
│
├── llm/
│   ├── types.ts              Provider-agnostic interfaces
│   ├── service.ts            Active provider (single swap point)
│   └── providers/
│       ├── groq.ts
│       ├── openrouter.ts
│       └── gemini.ts
│
├── mcp/
│   ├── server.ts             MCP server — all tools registered via McpServer
│   ├── client.ts             MCP client — connected via InMemoryTransport
│   ├── tools/                Tool handler implementations
│   ├── resources/            Resource-style tool implementations
│   └── prompts/              System prompt templates
│
└── github/client.ts          GitHub REST API wrapper
```

### How the agent loop works

Each command calls `runAgent()`, which:

1. Connects an MCP `Client` to the `McpServer` over `InMemoryTransport` (in-process, no subprocess)
2. Fetches the full tool list; filters to the command's `allowedTools` if specified
3. Runs a **while loop** (capped at 10 iterations):
   - Sends the current message history + available tools to the LLM
   - **Tool calls** → executes each via the MCP client, appends results, loops again
   - **`stop`** → returns the final answer
4. Closes the MCP client

### Available tools

| Tool | Description |
|---|---|
| `get_pr_diff` | PR metadata, changed file list, and unified diff |
| `get_repo_tree` | All source files as a flat path list (filterable) |
| `search_repo` | GitHub code search — returns paths and matching snippets |
| `read_file_chunk` | Specific line range from a file |
| `read_file` | Full file content |
| `comment_on_pr` | Post a markdown comment on a pull request |
| `create_issue` | Create a new GitHub issue |
| `list_issues` | List open/closed issues |
| `run_tests` | Run the local test suite and return exit code + output |

---

## Adding a New Tool

1. Create a handler in [src/mcp/tools/](src/mcp/tools/):

```ts
// src/mcp/tools/my_tool.ts
export const myTool = {
  name: 'my_tool',
  description: 'Does something useful.',
  async handler(input: { param: string; repo: string }): Promise<string> {
    // use input.repo and input.param
    return 'result';
  },
};
```

2. Register it in [src/mcp/server.ts](src/mcp/server.ts):

```ts
import { myTool } from './tools/my_tool';
import { z } from 'zod';

server.registerTool(myTool.name, {
  description: myTool.description,
  inputSchema: z.looseObject({
    param: z.string().describe('Description for the LLM'),
  }),
}, async (args) => {
  const text = await myTool.handler(args as Parameters<typeof myTool.handler>[0]);
  return { content: [{ type: 'text' as const, text }] };
});
```

> `z.looseObject` allows the agent-injected `repo` argument to pass through Zod validation without appearing in the schema the LLM sees.

---

## Development

```bash
# Run without a build step
bun run src/index.ts ask --repo acme/api "How does auth work?"

# Type-check
bun x tsc --noEmit

# Format
bun x prettier --write src/
```

## License

MIT

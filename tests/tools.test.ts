import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test';
import { loadConfig } from '../src/config/index';
import { searchRepoTool } from '../src/mcp/tools/search_repo';
import { getRepoTreeTool } from '../src/mcp/tools/get_repo_tree';
import { readFileChunkTool } from '../src/mcp/tools/read_file_chunk';
import { getPrDiffTool } from '../src/mcp/tools/get_pr_diff';
import { runTestsTool } from '../src/mcp/tools/run_tests';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
  await loadConfig();
});

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchJson(body: unknown) {
  global.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response)
  ) as unknown as typeof fetch;
}

function mockFetchText(text: string) {
  global.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => text,
    } as Response)
  ) as unknown as typeof fetch;
}

// ── search_repo ───────────────────────────────────────────────────────────────

describe('searchRepoTool', () => {
  test('has correct name and required inputSchema fields', () => {
    expect(searchRepoTool.name).toBe('search_repo');
    expect(searchRepoTool.inputSchema.required).toContain('query');
  });

  test("returns 'no results' message when items array is empty", async () => {
    mockFetchJson({ total_count: 0, items: [] });

    const result = await searchRepoTool.handler({
      query: 'nonexistent',
      repo: 'owner/repo',
    });

    expect(result).toContain('No results found for "nonexistent"');
    expect(result).toContain('owner/repo');
  });

  test('formats results with total count and file paths', async () => {
    mockFetchJson({
      total_count: 2,
      items: [
        { path: 'src/auth.ts', html_url: 'https://github.com/...' },
        { path: 'src/login.ts', html_url: 'https://github.com/...' },
      ],
    });

    const result = await searchRepoTool.handler({
      query: 'authenticate',
      repo: 'owner/repo',
    });

    expect(result).toContain('Found 2 results');
    expect(result).toContain('src/auth.ts');
    expect(result).toContain('src/login.ts');
  });

  test('includes text match snippets when present', async () => {
    mockFetchJson({
      total_count: 1,
      items: [
        {
          path: 'src/auth.ts',
          html_url: 'https://...',
          text_matches: [{ fragment: 'function authenticate(user)' }],
        },
      ],
    });

    const result = await searchRepoTool.handler({
      query: 'authenticate',
      repo: 'owner/repo',
    });

    expect(result).toContain('function authenticate(user)');
  });
});

// ── get_repo_tree ─────────────────────────────────────────────────────────────

describe('getRepoTreeTool', () => {
  test('has correct name', () => {
    expect(getRepoTreeTool.name).toBe('get_repo_tree');
  });

  function mockRepoTree(paths: string[]) {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ default_branch: 'main' }),
          text: async () => '',
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          truncated: false,
          tree: paths.map((p) => ({ path: p, type: 'blob' })),
        }),
        text: async () => '',
      } as Response);
    }) as unknown as typeof fetch;
  }

  test('returns all file paths when no filter', async () => {
    mockRepoTree(['src/index.ts', 'src/utils.ts', 'README.md']);

    const result = await getRepoTreeTool.handler({ repo: 'owner/repo' });

    expect(result).toContain('src/index.ts');
    expect(result).toContain('src/utils.ts');
    expect(result).toContain('README.md');
    expect(result).toContain('3 file(s)');
  });

  test('filters paths by filter string', async () => {
    mockRepoTree(['src/index.ts', 'src/utils.ts', 'tests/index.test.ts']);

    const result = await getRepoTreeTool.handler({
      repo: 'owner/repo',
      filter: 'tests/',
    });

    expect(result).toContain('tests/index.test.ts');
    expect(result).not.toContain('src/index.ts');
    expect(result).toContain('matching "tests/"');
  });

  test("returns 'no files matching' when filter yields nothing", async () => {
    mockRepoTree(['src/index.ts']);

    const result = await getRepoTreeTool.handler({
      repo: 'owner/repo',
      filter: 'nonexistent/',
    });

    expect(result).toContain('No files matching "nonexistent/"');
  });

  test("returns 'no source files' when tree is empty", async () => {
    mockRepoTree([]);

    const result = await getRepoTreeTool.handler({ repo: 'owner/repo' });

    expect(result).toContain('No source files found');
  });
});

// ── read_file_chunk ───────────────────────────────────────────────────────────

describe('readFileChunkTool', () => {
  test('has correct name and required fields', () => {
    expect(readFileChunkTool.name).toBe('read_file_chunk');
    expect(readFileChunkTool.inputSchema.required).toContain('path');
    expect(readFileChunkTool.inputSchema.required).toContain('start_line');
    expect(readFileChunkTool.inputSchema.required).toContain('end_line');
  });

  const fileContent = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join(
    '\n'
  );

  beforeAll(() => {
    // encode for base64
  });

  function mockFileContent(content: string) {
    mockFetchJson({
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64',
    });
  }

  test('returns correct line range with 1-based numbering', async () => {
    mockFileContent(fileContent);

    const result = await readFileChunkTool.handler({
      repo: 'owner/repo',
      path: 'src/file.ts',
      start_line: 2,
      end_line: 4,
    });

    expect(result).toContain('2: line 2');
    expect(result).toContain('3: line 3');
    expect(result).toContain('4: line 4');
    expect(result).not.toContain('1: line 1');
    expect(result).not.toContain('5: line 5');
  });

  test('header shows file path and line range', async () => {
    mockFileContent(fileContent);

    const result = await readFileChunkTool.handler({
      repo: 'owner/repo',
      path: 'src/file.ts',
      start_line: 1,
      end_line: 2,
    });

    expect(result).toContain('// src/file.ts (lines 1–2 of 5)');
  });

  test('clamps start_line to 1 when given 0 or negative', async () => {
    mockFileContent(fileContent);

    const result = await readFileChunkTool.handler({
      repo: 'owner/repo',
      path: 'src/file.ts',
      start_line: 0,
      end_line: 2,
    });

    expect(result).toContain('1: line 1');
  });

  test('clamps end_line to file length when exceeding total lines', async () => {
    mockFileContent(fileContent);

    const result = await readFileChunkTool.handler({
      repo: 'owner/repo',
      path: 'src/file.ts',
      start_line: 4,
      end_line: 999,
    });

    expect(result).toContain('4: line 4');
    expect(result).toContain('5: line 5');
    expect(result).toContain('lines 4–5 of 5');
  });
});

// ── get_pr_diff ───────────────────────────────────────────────────────────────

describe('getPrDiffTool', () => {
  test('has correct name', () => {
    expect(getPrDiffTool.name).toBe('get_pr_diff');
  });

  test('formats PR metadata, changed files, and diff together', async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        // getPR
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            title: 'Add auth middleware',
            body: 'Adds JWT auth.',
            user: { login: 'dev1' },
            head: { ref: 'feat/auth' },
            base: { ref: 'main' },
          }),
          text: async () => '',
        } as Response);
      }
      if (callCount === 2) {
        // getPRFiles
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            { filename: 'src/auth.ts', status: 'added', changes: 50 },
          ],
          text: async () => '',
        } as Response);
      }
      // getPRDiff
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => 'diff --git a/src/auth.ts b/src/auth.ts\n+new line',
      } as Response);
    }) as unknown as typeof fetch;

    const result = await getPrDiffTool.handler({
      repo: 'owner/repo',
      pr_number: 42,
    });

    expect(result).toContain('PR #42: Add auth middleware');
    expect(result).toContain('Author: dev1');
    expect(result).toContain('feat/auth → main');
    expect(result).toContain('Adds JWT auth.');
    expect(result).toContain('src/auth.ts');
    expect(result).toContain('diff --git');
  });

  test("shows '(none)' for PR body when null", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            title: 'Quick fix',
            body: null,
            user: { login: 'dev1' },
            head: { ref: 'fix' },
            base: { ref: 'main' },
          }),
          text: async () => '',
        } as Response);
      }
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
          text: async () => '',
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '',
      } as Response);
    }) as unknown as typeof fetch;

    const result = await getPrDiffTool.handler({
      repo: 'owner/repo',
      pr_number: 1,
    });

    expect(result).toContain('(none)');
  });
});

// ── run_tests ─────────────────────────────────────────────────────────────────

describe('runTestsTool', () => {
  test('has correct name', () => {
    expect(runTestsTool.name).toBe('run_tests');
  });

  test('returns exit code and output when command succeeds', async () => {
    // Use a fast, safe command instead of 'bun test' to avoid recursion
    const result = await runTestsTool.handler({
      repo: 'owner/repo',
      command: 'bun --version',
    });

    expect(result).toContain('Exit code: 0');
    // bun --version outputs something like "1.x.y"
    expect(result).toMatch(/\d+\.\d+/);
  });

  test('uses custom command when provided', async () => {
    // Use 'echo' as a safe command that always succeeds
    const result = await runTestsTool.handler({
      repo: 'owner/repo',
      command: 'echo hello',
    });

    expect(result).toContain('Exit code: 0');
    expect(result).toContain('hello');
  });

  test('reports error when command binary is not found', async () => {
    const result = await runTestsTool.handler({
      repo: 'owner/repo',
      command: 'totally-nonexistent-binary-xyz --flag',
    });

    expect(result).toContain('Failed to run');
  });
});

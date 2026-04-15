import { describe, test, expect, beforeAll, afterEach, mock } from 'bun:test';
import { loadConfig } from '../src/config/index';
import {
  searchCode,
  getFileContent,
  getPR,
  getPRFiles,
  getPRDiff,
  commentOnPR,
  createIssue,
  getIssues,
  getCommits,
  getRepoTree,
} from '../src/github/client';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.GITHUB_TOKEN = 'test-gh-token';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GROQ_API_KEY = 'test-key';
  await loadConfig();
});

// ── Fetch mock helpers ────────────────────────────────────────────────────────

const originalFetch = global.fetch;

function mockFetchJson(body: unknown, ok = true) {
  global.fetch = mock(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 422,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response)
  ) as unknown as typeof fetch;
}

function mockFetchText(text: string, ok = true) {
  global.fetch = mock(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 404,
      json: async () => ({}),
      text: async () => text,
    } as Response)
  ) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
});

// ── searchCode ────────────────────────────────────────────────────────────────

describe('searchCode()', () => {
  test('calls the GitHub search/code endpoint', async () => {
    const payload = { total_count: 1, items: [{ path: 'src/auth.ts' }] };
    mockFetchJson(payload);

    const result = await searchCode('owner/repo', 'authenticate');

    expect(result).toEqual(payload);
    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/search/code');
    expect(url).toContain(encodeURIComponent('owner/repo'));
  });

  test('URL-encodes the query and repo', async () => {
    mockFetchJson({ total_count: 0, items: [] });

    await searchCode('owner/repo', 'my query');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(encodeURIComponent('my query repo:owner/repo'));
  });

  test('throws on non-ok response', async () => {
    mockFetchJson({ message: 'Validation Failed' }, false);
    await expect(searchCode('owner/repo', 'q')).rejects.toThrow('GitHub API');
  });
});

// ── getFileContent ────────────────────────────────────────────────────────────

describe('getFileContent()', () => {
  test('decodes base64-encoded content', async () => {
    const raw = 'hello world';
    const encoded = Buffer.from(raw).toString('base64');
    mockFetchJson({ content: encoded + '\n', encoding: 'base64' });

    const result = await getFileContent('owner/repo', 'README.md');
    expect(result).toBe(raw);
  });

  test('returns raw content when encoding is not base64', async () => {
    mockFetchJson({ content: 'plain text', encoding: 'utf-8' });

    const result = await getFileContent('owner/repo', 'file.txt');
    expect(result).toBe('plain text');
  });

  test('appends ?ref= when ref is provided', async () => {
    mockFetchJson({ content: '', encoding: 'utf-8' });

    await getFileContent('owner/repo', 'file.ts', 'main');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('?ref=main');
  });

  test('does not append ?ref when ref is omitted', async () => {
    mockFetchJson({ content: '', encoding: 'utf-8' });

    await getFileContent('owner/repo', 'file.ts');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('?ref=');
  });
});

// ── getPR / getPRFiles ────────────────────────────────────────────────────────

describe('getPR()', () => {
  test('calls /repos/{repo}/pulls/{number}', async () => {
    const prData = { title: 'Fix bug', number: 42 };
    mockFetchJson(prData);

    const result = await getPR('owner/repo', 42);
    expect(result).toEqual(prData);

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/owner/repo/pulls/42');
  });
});

describe('getPRFiles()', () => {
  test('calls /repos/{repo}/pulls/{number}/files', async () => {
    mockFetchJson([{ filename: 'src/index.ts', status: 'modified' }]);

    await getPRFiles('owner/repo', 7);

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/owner/repo/pulls/7/files');
  });
});

// ── getPRDiff ─────────────────────────────────────────────────────────────────

describe('getPRDiff()', () => {
  test('returns diff text from the diff accept header request', async () => {
    const diffText = 'diff --git a/src/index.ts b/src/index.ts\n+added line';
    mockFetchText(diffText);

    const result = await getPRDiff('owner/repo', 3);
    expect(result).toBe(diffText);
  });

  test('throws on non-ok response', async () => {
    mockFetchText('Not Found', false);
    await expect(getPRDiff('owner/repo', 999)).rejects.toThrow('GitHub API');
  });
});

// ── commentOnPR ───────────────────────────────────────────────────────────────

describe('commentOnPR()', () => {
  test('POSTs to /repos/{repo}/issues/{number}/comments', async () => {
    mockFetchJson({ id: 1 });

    await commentOnPR('owner/repo', 5, 'Looks good!');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/owner/repo/issues/5/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ body: 'Looks good!' });
  });
});

// ── createIssue ───────────────────────────────────────────────────────────────

describe('createIssue()', () => {
  test('POSTs title, body, and labels', async () => {
    mockFetchJson({ number: 10 });

    await createIssue('owner/repo', 'Bug title', 'Bug body', ['bug']);

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/repos/owner/repo/issues');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Bug title',
      body: 'Bug body',
      labels: ['bug'],
    });
  });

  test('omits labels when not provided', async () => {
    mockFetchJson({ number: 11 });

    await createIssue('owner/repo', 'Title', 'Body');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).labels).toBeUndefined();
  });
});

// ── getIssues ─────────────────────────────────────────────────────────────────

describe('getIssues()', () => {
  test('defaults to state=open', async () => {
    mockFetchJson([]);

    await getIssues('owner/repo');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('state=open');
  });

  test('passes custom state parameter', async () => {
    mockFetchJson([]);

    await getIssues('owner/repo', 'closed');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('state=closed');
  });
});

// ── getCommits ────────────────────────────────────────────────────────────────

describe('getCommits()', () => {
  test('defaults to per_page=10', async () => {
    mockFetchJson([]);

    await getCommits('owner/repo');

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('per_page=10');
  });

  test('uses custom perPage value', async () => {
    mockFetchJson([]);

    await getCommits('owner/repo', 25);

    const fetchMock = global.fetch as unknown as ReturnType<typeof mock>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('per_page=25');
  });
});

// ── getRepoTree ───────────────────────────────────────────────────────────────

describe('getRepoTree()', () => {
  function makeFetchSequence(responses: unknown[]) {
    let callCount = 0;
    global.fetch = mock(() => {
      const body = responses[callCount++];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as Response);
    }) as unknown as typeof fetch;
  }

  test('returns only blob paths, filtered of ignored dirs and binary files', async () => {
    makeFetchSequence([
      { default_branch: 'main' },
      {
        truncated: false,
        tree: [
          { path: 'src/index.ts', type: 'blob' },
          { path: 'src/', type: 'tree' },
          { path: 'node_modules/lodash/index.js', type: 'blob' },
          { path: '.git/config', type: 'blob' },
          { path: 'dist/bundle.js', type: 'blob' },
          { path: 'assets/logo.png', type: 'blob' },
          { path: 'src/utils.ts', type: 'blob' },
        ],
      },
    ]);

    const paths = await getRepoTree('owner/repo');

    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/utils.ts');
    expect(paths).not.toContain('src/'); // tree type
    expect(paths).not.toContain('node_modules/lodash/index.js');
    expect(paths).not.toContain('.git/config');
    expect(paths).not.toContain('dist/bundle.js');
    expect(paths).not.toContain('assets/logo.png');
  });

  test('filters binary file extensions (jpg, png, svg, pdf, etc.)', async () => {
    makeFetchSequence([
      { default_branch: 'main' },
      {
        truncated: false,
        tree: [
          { path: 'docs/guide.pdf', type: 'blob' },
          { path: 'icons/favicon.ico', type: 'blob' },
          { path: 'fonts/font.woff2', type: 'blob' },
          { path: 'src/component.tsx', type: 'blob' },
        ],
      },
    ]);

    const paths = await getRepoTree('owner/repo');

    expect(paths).toEqual(['src/component.tsx']);
  });
});

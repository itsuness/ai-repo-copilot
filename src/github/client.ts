import { getConfig } from '../config';

const GITHUB_API = 'https://api.github.com';

async function githubFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const config = getConfig();
  const url = `${GITHUB_API}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} on ${path}: ${body}`);
  }

  return response.json();
}

export async function searchCode(
  repo: string,
  query: string
): Promise<unknown> {
  return githubFetch(
    `/search/code?q=${encodeURIComponent(`${query} repo:${repo}`)}&per_page=10`,
    { headers: { Accept: 'application/vnd.github.v3.text-match+json' } }
  );
}

export async function getFileContent(
  repo: string,
  path: string,
  ref?: string
): Promise<string> {
  const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const data = (await githubFetch(
    `/repos/${repo}/contents/${path}${refParam}`
  )) as {
    content: string;
    encoding: string;
  };

  if (data.encoding === 'base64') {
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString(
      'utf-8'
    );
  }
  return data.content;
}

export async function getPR(repo: string, prNumber: number): Promise<unknown> {
  return githubFetch(`/repos/${repo}/pulls/${prNumber}`);
}

export async function getPRFiles(
  repo: string,
  prNumber: number
): Promise<unknown> {
  return githubFetch(`/repos/${repo}/pulls/${prNumber}/files`);
}

export async function getPRDiff(
  repo: string,
  prNumber: number
): Promise<string> {
  const config = getConfig();
  const response = await fetch(
    `${GITHUB_API}/repos/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github.v3.diff',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `GitHub API ${response.status} fetching diff for PR #${prNumber}`
    );
  }
  return response.text();
}

export async function commentOnPR(
  repo: string,
  prNumber: number,
  body: string
): Promise<unknown> {
  return githubFetch(`/repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function createIssue(
  repo: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<unknown> {
  return githubFetch(`/repos/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function getIssues(
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<unknown> {
  return githubFetch(`/repos/${repo}/issues?state=${state}&per_page=20`);
}

export async function getCommits(repo: string, perPage = 10): Promise<unknown> {
  return githubFetch(`/repos/${repo}/commits?per_page=${perPage}`);
}

export async function getRepoTree(repo: string): Promise<string[]> {
  const repoData = (await githubFetch(`/repos/${repo}`)) as {
    default_branch: string;
  };

  const tree = (await githubFetch(
    `/repos/${repo}/git/trees/${repoData.default_branch}?recursive=1`
  )) as {
    tree: Array<{ path: string; type: string }>;
    truncated: boolean;
  };

  const IGNORE = /^(node_modules|\.git|dist|build|coverage|\.next)\//;
  const BINARY =
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|lock)$/i;

  return tree.tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .filter((p) => !IGNORE.test(p) && !BINARY.test(p));
}

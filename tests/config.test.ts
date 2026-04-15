import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

const ENV_KEYS = [
  'GITHUB_TOKEN',
  'OPENROUTER_API_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'DEFAULT_REPO',
  'DEFAULT_MODEL',
  'LOG_LEVEL',
] as const;

describe('config', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    ENV_KEYS.forEach((k) => {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
      else delete process.env[k];
    });
  });

  describe('loadConfig()', () => {
    test('throws when all required env vars are missing', async () => {
      const { loadConfig } = await import('../src/config/index');
      await expect(loadConfig()).rejects.toThrow(
        'Missing required environment variables'
      );
    });

    test('error message lists each missing variable', async () => {
      process.env.GITHUB_TOKEN = 'gh-token';
      const { loadConfig } = await import('../src/config/index');
      const err = await loadConfig().catch((e: Error) => e);
      expect((err as Error).message).toContain('OPENROUTER_API_KEY');
      expect((err as Error).message).toContain('GEMINI_API_KEY');
      expect((err as Error).message).toContain('GROQ_API_KEY');
      expect((err as Error).message).not.toContain('GITHUB_TOKEN');
    });

    test('returns config with correct values when all vars present', async () => {
      process.env.GITHUB_TOKEN = 'gh-token';
      process.env.OPENROUTER_API_KEY = 'or-key';
      process.env.GEMINI_API_KEY = 'gem-key';
      process.env.GROQ_API_KEY = 'groq-key';
      process.env.DEFAULT_REPO = 'owner/repo';
      process.env.DEFAULT_MODEL = 'my-model';
      process.env.LOG_LEVEL = 'debug';

      const { loadConfig } = await import('../src/config/index');
      const cfg = await loadConfig();

      expect(cfg.githubToken).toBe('gh-token');
      expect(cfg.openrouterApiKey).toBe('or-key');
      expect(cfg.geminiApiKey).toBe('gem-key');
      expect(cfg.groqApiKey).toBe('groq-key');
      expect(cfg.defaultRepo).toBe('owner/repo');
      expect(cfg.defaultModel).toBe('my-model');
      expect(cfg.logLevel).toBe('debug');
    });

    test("uses default model 'claude-sonnet-4-5' when DEFAULT_MODEL is unset", async () => {
      process.env.GITHUB_TOKEN = 't';
      process.env.OPENROUTER_API_KEY = 't';
      process.env.GEMINI_API_KEY = 't';
      process.env.GROQ_API_KEY = 't';

      const { loadConfig } = await import('../src/config/index');
      const cfg = await loadConfig();

      expect(cfg.defaultModel).toBe('claude-sonnet-4-5');
    });

    test("uses default log level 'info' when LOG_LEVEL is unset", async () => {
      process.env.GITHUB_TOKEN = 't';
      process.env.OPENROUTER_API_KEY = 't';
      process.env.GEMINI_API_KEY = 't';
      process.env.GROQ_API_KEY = 't';

      const { loadConfig } = await import('../src/config/index');
      const cfg = await loadConfig();

      expect(cfg.logLevel).toBe('info');
    });

    test('defaultRepo is undefined when DEFAULT_REPO is unset', async () => {
      process.env.GITHUB_TOKEN = 't';
      process.env.OPENROUTER_API_KEY = 't';
      process.env.GEMINI_API_KEY = 't';
      process.env.GROQ_API_KEY = 't';

      const { loadConfig } = await import('../src/config/index');
      const cfg = await loadConfig();

      expect(cfg.defaultRepo).toBeUndefined();
    });
  });

  describe('getConfig()', () => {
    test('returns the cached config after loadConfig() succeeds', async () => {
      process.env.GITHUB_TOKEN = 'cached-token';
      process.env.OPENROUTER_API_KEY = 't';
      process.env.GEMINI_API_KEY = 't';
      process.env.GROQ_API_KEY = 't';

      const { loadConfig, getConfig } = await import('../src/config/index');
      await loadConfig();
      const cfg = getConfig();

      expect(cfg.githubToken).toBe('cached-token');
    });
  });
});

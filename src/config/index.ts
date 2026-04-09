import { config } from 'dotenv';

export interface AppConfig {
  githubToken: string;
  anthropicApiKey: string;
  defaultRepo?: string;
  defaultModel: string;
  logLevel: string;
}

let _config: AppConfig;

export async function loadConfig(): Promise<AppConfig> {
  config(); // loads .env into process.env

  const missing: string[] = [];

  if (!process.env.GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill in the values.`
    );
  }

  _config = {
    githubToken: process.env.GITHUB_TOKEN!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    defaultRepo: process.env.DEFAULT_REPO,
    defaultModel: process.env.DEFAULT_MODEL ?? 'claude-sonnet-4-5',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };

  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.');
  return _config;
}

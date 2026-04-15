import { config } from 'dotenv';

export interface AppConfig {
  githubToken: string;
  openrouterApiKey: string;
  geminiApiKey: string;
  groqApiKey: string;
  defaultRepo?: string;
  defaultModel: string;
  logLevel: string;
}

let _config: AppConfig;

export async function loadConfig(): Promise<AppConfig> {
  config(); // loads .env into process.env

  const missing: string[] = [];

  if (!process.env.GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
  if (!process.env.OPENROUTER_API_KEY) missing.push('OPENROUTER_API_KEY');
  if (!process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!process.env.GROQ_API_KEY) missing.push('GROQ_API_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill in the values.`
    );
  }

  _config = {
    githubToken: process.env.GITHUB_TOKEN!,
    openrouterApiKey: process.env.OPENROUTER_API_KEY!,
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    groqApiKey: process.env.GROQ_API_KEY ?? '',
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

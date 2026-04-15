import { describe, test, expect } from 'bun:test';
import { resolveContext } from '../src/types/index';

describe('resolveContext()', () => {
  const baseOpts = { model: 'my-model', debug: false };

  test('uses commandOpts.repo when provided', () => {
    const ctx = resolveContext(
      { ...baseOpts, repo: 'global/repo' },
      { repo: 'cmd/repo' }
    );
    expect(ctx.repo).toBe('cmd/repo');
  });

  test('falls back to opts.repo when commandOpts.repo is absent', () => {
    const ctx = resolveContext({ ...baseOpts, repo: 'global/repo' }, {});
    expect(ctx.repo).toBe('global/repo');
  });

  test('throws when neither opts.repo nor commandOpts.repo is provided', () => {
    expect(() => resolveContext({ ...baseOpts }, {})).toThrow(
      'No repository specified'
    );
  });

  test('error message mentions --repo and DEFAULT_REPO', () => {
    expect(() => resolveContext({ ...baseOpts }, {})).toThrow(
      '--repo owner/name or set DEFAULT_REPO'
    );
  });

  test('returns model from opts', () => {
    const ctx = resolveContext(
      { ...baseOpts, model: 'groq-llama', repo: 'o/r' },
      {}
    );
    expect(ctx.model).toBe('groq-llama');
  });

  test('commandOpts.repo undefined falls through to opts.repo', () => {
    const ctx = resolveContext(
      { ...baseOpts, repo: 'fallback/repo' },
      { repo: undefined }
    );
    expect(ctx.repo).toBe('fallback/repo');
  });
});

import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import type { Db } from '../../src/db/client.js';
import { createModelResolver, type ModelResolver } from '../../src/insights/providers.js';

export function buildApp(db: Db, opts: { resolveModels?: ModelResolver; apiKey?: string; env?: Record<string, string> } = {}) {
  const config = loadConfig({ AI_PROVIDER: 'mock', ...opts.env });
  return createApp({
    db,
    resolveModels: opts.resolveModels ?? createModelResolver(config.ai),
    aiMode: 'mock',
    apiKey: opts.apiKey,
  });
}

export const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

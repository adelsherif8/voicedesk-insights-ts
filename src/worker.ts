/**
 * Cloudflare Workers entry (not deployed; kept to show the app is runtime-agnostic).
 * It reuses createApp() unchanged and swaps only the edges: the env comes from bindings and the
 * database from a Hyperdrive connection string. Needs `nodejs_compat` for `pg` (see wrangler.toml).
 * No OTel SDK is registered here, so spans are no-ops unless a Workers OTel exporter is added.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { createApp, describeAi } from './app.js';
import { loadConfig } from './config.js';
import * as schema from './db/schema.js';
import { createModelResolver } from './insights/providers.js';

interface Env {
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const strings = Object.fromEntries(
      Object.entries(env).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    const config = loadConfig(strings);
    const connectionString = env.HYPERDRIVE?.connectionString ?? config.databaseUrl;
    if (!connectionString) return new Response('database not configured', { status: 500 });

    // Per-request client, as recommended with Hyperdrive (it pools on its side).
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      const app = createApp({
        db: drizzle({ client, schema }),
        resolveModels: createModelResolver(config.ai),
        aiMode: describeAi(config.ai.primary, config.ai.fallback),
        apiKey: config.apiKey,
      });
      return await app.fetch(request);
    } finally {
      await client.end();
    }
  },
};

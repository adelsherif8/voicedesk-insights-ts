import { httpInstrumentationMiddleware } from '@hono/otel';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { HTTPException } from 'hono/http-exception';
import type { Db } from './db/client.js';
import { createRepository } from './db/repository.js';
import type { ModelResolver } from './insights/providers.js';
import { callOutcomeRoutes } from './routes/call-outcomes.js';
import { insightRoutes } from './routes/insights.js';

export interface AppDeps {
  db: Db;
  resolveModels: ModelResolver;
  /** shown on /health, e.g. "mock" or "openai -> anthropic" */
  aiMode: string;
  apiKey?: string;
  serviceName?: string;
}

/**
 * Runtime-agnostic: no Node APIs, no process.env, no driver import. The Node server (src/server.ts)
 * and the Workers entry (src/worker.ts) each build the deps and call this.
 */
export function createApp(deps: AppDeps) {
  const repo = createRepository(deps.db);
  const app = new Hono();

  app.use(
    '*',
    httpInstrumentationMiddleware({
      serviceName: deps.serviceName ?? 'voicedesk-insights',
      // search text can sit in the query string; keep it out of traces
      getUrlFull: (c) => new URL(c.req.url).origin + c.req.path,
    }),
  );

  app.get('/health', async (c) => {
    let db: 'ok' | 'error' = 'ok';
    try {
      await repo.ping();
    } catch {
      db = 'error';
    }
    return c.json({ status: db === 'ok' ? 'ok' : 'degraded', db, ai: deps.aiMode }, db === 'ok' ? 200 : 503);
  });

  if (deps.apiKey) {
    app.use('/call-outcomes/*', bearerAuth({ token: deps.apiKey }));
    app.use('/insights/*', bearerAuth({ token: deps.apiKey }));
  }

  app.route('/call-outcomes', callOutcomeRoutes(repo));
  app.route('/insights', insightRoutes(repo, deps.resolveModels));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

export function describeAi(primary: string, fallback: string | null): string {
  return fallback ? `${primary} -> ${fallback}` : primary;
}

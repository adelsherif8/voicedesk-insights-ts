import { serve } from '@hono/node-server';
import { createApp, describeAi } from './app.js';
import { loadConfig } from './config.js';
import { createNodeDb } from './db/node.js';
import { createModelResolver } from './insights/providers.js';
import { startTelemetry } from './telemetry/node.js';

const config = loadConfig(process.env);
if (!config.databaseUrl) throw new Error('DATABASE_URL is required (see .env.example)');

const telemetry = startTelemetry(config.telemetry);
const { db, close } = createNodeDb(config.databaseUrl);
const aiMode =
  config.ai.primary === 'mock'
    ? config.ai.mockPrimaryInvalid
      ? 'mock (primary returns invalid output -> mock fallback)'
      : 'mock'
    : describeAi(config.ai.primary, config.ai.fallback);

const app = createApp({
  db,
  resolveModels: createModelResolver(config.ai),
  aiMode,
  apiKey: config.apiKey,
  serviceName: config.telemetry.serviceName,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`voicedesk-insights listening on http://localhost:${info.port} (ai: ${aiMode})`);
});

async function shutdown() {
  server.close();
  await close();
  await telemetry.shutdown();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

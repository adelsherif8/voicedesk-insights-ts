import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRepository } from '../../src/db/repository.js';
import { sampleRows } from '../../src/db/sample-data.js';
import { startTelemetry } from '../../src/telemetry/node.js';
import { buildApp, json } from '../helpers/app.js';
import { createTestDb, type TestDb } from '../helpers/db.js';

describe('startTelemetry', () => {
  it.each(['none', 'console', 'otlp'] as const)('%s exporter starts and shuts down cleanly', async (exporter) => {
    const t = startTelemetry({ exporter, serviceName: 'test', otlpEndpoint: 'http://127.0.0.1:4318/' });
    await expect(t.shutdown()).resolves.toBeUndefined();
    trace.disable();
  });
});

describe('spans emitted by a request', () => {
  const exporter = new InMemorySpanExporter();
  let db: TestDb;

  beforeAll(async () => {
    new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();
    db = await createTestDb();
    const repo = createRepository(db.db);
    for (const row of sampleRows()) await repo.create(row);
  });
  afterAll(async () => {
    trace.disable();
    await db.close();
  });

  it('records the HTTP span, one span per insight attempt, and AI SDK spans', async () => {
    const app = buildApp(db.db, { env: { MOCK_PRIMARY_INVALID: 'true' } });
    const res = await app.request('/insights?q=private', json({ agent: 'sales' }));
    expect(res.status).toBe(201);

    const spans = exporter.getFinishedSpans();
    const http = spans.find((s) => s.attributes['http.request.method'] === 'POST');
    expect(http).toBeDefined();
    expect(String(http?.attributes['url.full'])).not.toContain('private');

    const attempts = spans.filter((s) => s.name === 'insight.attempt');
    expect(attempts.map((s) => [s.attributes['insight.attempt'], s.attributes['insight.failure'] ?? 'ok'])).toEqual([
      [1, 'validation'],
      [2, 'ok'],
    ]);
    // attempt spans are children of the HTTP request span
    expect(attempts.every((s) => s.spanContext().traceId === http?.spanContext().traceId)).toBe(true);

    // AI SDK spans (GenAI semantic-convention names) for both model calls
    const names = spans.map((s) => s.name);
    expect(names).toContain('chat deterministic-v1-invalid');
    expect(names).toContain('chat deterministic-fallback');
  });
});

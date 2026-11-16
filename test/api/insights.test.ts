import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRepository } from '../../src/db/repository.js';
import { sampleRows } from '../../src/db/sample-data.js';
import { heuristicInsight } from '../../src/insights/mock-model.js';
import type { BriefRow } from '../../src/insights/redact.js';
import { InsightSchema } from '../../src/insights/schema.js';
import { buildApp, json, read } from '../helpers/app.js';
import { createTestDb, type TestDb } from '../helpers/db.js';
import { fakeModel, promptText } from '../helpers/models.js';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());
beforeEach(async () => {
  await t.reset();
  const repo = createRepository(t.db);
  for (const row of sampleRows()) await repo.create(row);
});

describe('POST /insights (MOCK mode)', () => {
  it('generates, validates and stores a structured insight for one agent', async () => {
    const app = buildApp(t.db);
    const res = await app.request('/insights', json({ agent: 'receptionist' }));
    expect(res.status).toBe(201);
    const body = await read(res);
    expect(res.headers.get('location')).toBe(`/insights/${body.id}`);
    expect(body).toMatchObject({
      agent: 'receptionist',
      provider: 'mock',
      model: 'deterministic-v1',
      fallbackUsed: false,
      fallbackReason: null,
      attempts: [{ provider: 'mock', model: 'deterministic-v1', ok: true }],
    });
    expect(InsightSchema.safeParse(body.insight).success).toBe(true);
    expect(body.callOutcomeIds).toHaveLength(5);
    expect(body.insight.summary).toContain('5 call(s) analysed');
    // Tom Alvarez's "Follow-up sent" is the open call among the receptionist samples
    const missed = body.insight.missedOpportunities.map((m: { callOutcomeId: number }) => m.callOutcomeId);
    expect(missed).toEqual([3]);

    const stored = await read(await app.request(`/insights/${body.id}`));
    expect(stored.insight).toEqual(body.insight);
    expect(stored.provider).toBe('mock');
  });

  it('is deterministic for the same records', async () => {
    const app = buildApp(t.db);
    const a = await read(await app.request('/insights', json({ agent: 'sales' })));
    const b = await read(await app.request('/insights', json({ agent: 'sales' })));
    expect(a.insight).toEqual(b.insight);
    expect(b.id).toBe(a.id + 1);
  });

  it('analyses exactly the requested ids (duplicates collapsed)', async () => {
    const app = buildApp(t.db);
    const body = await read(await app.request('/insights', json({ callOutcomeIds: [1, 2, 2] })));
    expect([...body.callOutcomeIds].sort()).toEqual([1, 2]);
    expect(body.agent).toBeNull();
  });

  it('respects limit across all agents', async () => {
    const body = await read(await buildApp(t.db).request('/insights', json({ limit: 4 })));
    expect(body.callOutcomeIds).toHaveLength(4);
  });

  it('404 lists ids that do not exist', async () => {
    const res = await buildApp(t.db).request('/insights', json({ callOutcomeIds: [1, 5000] }));
    expect(res.status).toBe(404);
    expect(await read(res)).toEqual({ error: 'not_found', missing: [5000] });
  });

  it('422 when there is nothing to analyse', async () => {
    const res = await buildApp(t.db).request('/insights', json({ agent: 'no-such-agent' }));
    expect(res.status).toBe(422);
  });

  it.each([
    [{ limit: 0 }],
    [{ limit: 51 }],
    [{ callOutcomeIds: [] }],
    [{ callOutcomeIds: [-1] }],
    [{ agent: 'BAD AGENT' }],
    [{ provider: 'openai' }],
  ])('400 for invalid body %j', async (body) => {
    expect((await buildApp(t.db).request('/insights', json(body))).status).toBe(400);
  });

  it('MOCK_PRIMARY_INVALID=true runs the fallback path offline', async () => {
    const app = buildApp(t.db, { env: { MOCK_PRIMARY_INVALID: 'true' } });
    const body = await read(await app.request('/insights', json({ agent: 'dental' })));
    expect(body).toMatchObject({ fallbackUsed: true, fallbackReason: 'validation', model: 'deterministic-fallback' });
    expect(body.attempts[0]).toMatchObject({ ok: false, failure: 'validation', model: 'deterministic-v1-invalid' });
    const stored = await read(await app.request(`/insights/${body.id}`));
    expect(stored).toMatchObject({ fallbackUsed: true, fallbackReason: 'validation' });
  });

  it('GET /insights/:id 404 and 400', async () => {
    const app = buildApp(t.db);
    expect((await app.request('/insights/12345')).status).toBe(404);
    expect((await app.request('/insights/x')).status).toBe(400);
  });
});

describe('POST /insights (provider chain)', () => {
  it('sends only redacted rows to the model: no caller names, phones or emails', async () => {
    let captured: BriefRow[] = [];
    let calls: ReturnType<typeof fakeModel>['calls'] = [];
    const app = buildApp(t.db, {
      resolveModels: (rows) => {
        captured = rows;
        const m = fakeModel('openai', { text: JSON.stringify(heuristicInsight(rows)) });
        calls = m.calls;
        return [m.named];
      },
    });
    const res = await app.request('/insights', json({ agent: 'realty' }));
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(1);
    const sent = promptText(calls[0]);
    expect(sent).toContain('Maple Ridge'); // the record content is there...
    for (const s of ['Grace Lin', 'Daniel', 'Osei', '202 555', 'd.osei@example.com']) expect(sent).not.toContain(s); // ...the caller is not
    expect(captured.every((r) => Object.keys(r).sort().join() === 'id,intent,outcome,summary')).toBe(true);
  });

  it('falls back from a bad OpenAI answer to Anthropic and records why', async () => {
    const app = buildApp(t.db, {
      resolveModels: (rows) => [
        fakeModel('openai', { text: JSON.stringify({ summary: 'only a summary' }) }).named,
        fakeModel('anthropic', { text: JSON.stringify(heuristicInsight(rows)) }).named,
      ],
    });
    const body = await read(await app.request('/insights', json({ agent: 'support' })));
    expect(body).toMatchObject({ provider: 'anthropic', model: 'anthropic-fake', fallbackUsed: true, fallbackReason: 'validation' });
  });

  it('502 with every attempt when both providers fail; nothing is stored', async () => {
    const app = buildApp(t.db, {
      resolveModels: () => [
        fakeModel('openai', { text: 'not json' }).named,
        fakeModel('anthropic', { error: new Error('boom') }).named,
      ],
    });
    const res = await app.request('/insights', json({ agent: 'support' }));
    expect(res.status).toBe(502);
    const body = await read(res);
    expect(body.error).toBe('insight_generation_failed');
    expect(body.attempts.map((a: { failure: string }) => a.failure)).toEqual(['validation', 'provider_error']);
    expect((await app.request('/insights/1')).status).toBe(404);
  });

  it('unexpected errors become a JSON 500 without leaking details', async () => {
    const app = buildApp(t.db, {
      resolveModels: () => {
        throw new Error('secret internal detail');
      },
    });
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = (e: unknown) => errors.push(e);
    try {
      const res = await app.request('/insights', json({ agent: 'support' }));
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain('secret');
    } finally {
      console.error = orig;
    }
    expect(errors).toHaveLength(1);
  });
});

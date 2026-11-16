import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRepository } from '../../src/db/repository.js';
import { sampleRows } from '../../src/db/sample-data.js';
import { buildApp, json, read } from '../helpers/app.js';
import { createTestDb, type TestDb } from '../helpers/db.js';

let t: TestDb;
let app: ReturnType<typeof buildApp>;
const NOW = new Date('2026-11-16T12:00:00Z');

beforeAll(async () => {
  t = await createTestDb();
  app = buildApp(t.db);
});
afterAll(async () => t.close());
beforeEach(async () => {
  await t.reset();
  const repo = createRepository(t.db);
  for (const row of sampleRows(NOW)) await repo.create(row);
});

const total = sampleRows().length;

describe('GET /call-outcomes', () => {
  it('lists newest first with default pagination', async () => {
    const res = await app.request('/call-outcomes');
    expect(res.status).toBe(200);
    const body = await read(res);
    expect(body.pagination).toEqual({ limit: 20, offset: 0, total });
    expect(body.data).toHaveLength(20);
    const times = body.data.map((r: { createdAt: string }) => Date.parse(r.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(body.data[0]).toMatchObject({ agent: 'recovery', isSample: true });
  });

  it('pages with limit and offset without overlap', async () => {
    const p1 = await read(await app.request('/call-outcomes?limit=5&offset=0'));
    const p2 = await read(await app.request('/call-outcomes?limit=5&offset=5'));
    const ids1 = p1.data.map((r: { id: number }) => r.id);
    const ids2 = p2.data.map((r: { id: number }) => r.id);
    expect(ids1).toHaveLength(5);
    expect(ids1.filter((id: number) => ids2.includes(id))).toEqual([]);
    const last = await read(await app.request(`/call-outcomes?limit=5&offset=${total - 2}`));
    expect(last.data).toHaveLength(2);
  });

  it('filters by agent', async () => {
    const body = await read(await app.request('/call-outcomes?agent=dental'));
    expect(body.pagination.total).toBe(3);
    expect(body.data.every((r: { agent: string }) => r.agent === 'dental')).toBe(true);
  });

  it('filters by outcome substring, case-insensitive', async () => {
    const body = await read(await app.request('/call-outcomes?outcome=BOOKED'));
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((r: { outcome: string }) => /booked/i.test(r.outcome))).toBe(true);
  });

  it('searches intent and summary with q, treating % literally', async () => {
    const body = await read(await app.request('/call-outcomes?q=gate%20code'));
    expect(body.data.map((r: { intent: string }) => r.intent)).toEqual(['Gate code not working']);
    const pct = await read(await app.request('/call-outcomes?q=%25'));
    expect(pct.pagination.total).toBe(0);
  });

  it('filters by time window', async () => {
    const from = new Date(NOW.getTime() - 60 * 60_000).toISOString();
    const body = await read(await app.request(`/call-outcomes?from=${from}&limit=100`));
    expect(body.pagination.total).toBeGreaterThan(0);
    expect(body.pagination.total).toBeLessThan(total);
    expect(body.data.every((r: { createdAt: string }) => r.createdAt >= from)).toBe(true);
    const to = new Date(NOW.getTime() - 60 * 60_000).toISOString();
    const older = await read(await app.request(`/call-outcomes?to=${to}&limit=100`));
    expect(older.pagination.total + body.pagination.total).toBe(total);
  });

  it.each([
    ['limit=0'],
    ['limit=101'],
    ['offset=-1'],
    ['agent=Not%20A%20Slug'],
    ['from=yesterday'],
    ['from=2026-11-16T12:00:00Z&to=2026-11-15T12:00:00Z'],
  ])('rejects bad query %s with 400', async (qs) => {
    const res = await app.request(`/call-outcomes?${qs}`);
    expect(res.status).toBe(400);
    const body = await read(res);
    expect(body.error).toBe('validation_failed');
    expect(body.issues.length).toBeGreaterThan(0);
  });
});

describe('GET /call-outcomes/:id', () => {
  it('returns one record', async () => {
    const res = await app.request('/call-outcomes/1');
    expect(res.status).toBe(200);
    expect(await read(res)).toMatchObject({ id: 1, agent: 'receptionist', callerName: 'Sarah Johnson' });
  });

  it('404 for a missing id, 400 for a non-numeric one', async () => {
    expect((await app.request('/call-outcomes/99999')).status).toBe(404);
    expect((await app.request('/call-outcomes/abc')).status).toBe(400);
    expect((await app.request('/call-outcomes/0')).status).toBe(400);
  });
});

describe('POST /call-outcomes', () => {
  const valid = {
    agent: 'receptionist',
    callerName: 'Test Caller',
    phone: '+1 202 555 0199',
    email: 'test@example.com',
    intent: 'Rent a 5x5',
    outcome: 'Reserved 5x5',
    meta: { unit_size: '5x5' },
  };

  it('creates a record, fills defaults and sets Location', async () => {
    const res = await app.request('/call-outcomes', json(valid));
    expect(res.status).toBe(201);
    const body = await read(res);
    expect(res.headers.get('location')).toBe(`/call-outcomes/${body.id}`);
    expect(body).toMatchObject({ ...valid, appointment: '', summary: '', transcript: '', isSample: false });
    const fetched = await read(await app.request(`/call-outcomes/${body.id}`));
    expect(fetched).toEqual(body);
  });

  it('accepts an explicit createdAt and trims strings', async () => {
    const res = await app.request(
      '/call-outcomes',
      json({ ...valid, intent: '  padded  ', createdAt: '2026-01-02T03:04:05.000Z' }),
    );
    const body = await read(res);
    expect(body.intent).toBe('padded');
    expect(body.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it.each([
    ['missing intent', { ...valid, intent: undefined }, 'intent'],
    ['blank outcome', { ...valid, outcome: '   ' }, 'outcome'],
    ['bad email', { ...valid, email: 'not-an-email' }, 'email'],
    ['bad agent slug', { ...valid, agent: 'Front Desk!' }, 'agent'],
    ['unknown key (cannot mark rows as sample)', { ...valid, isSample: true }, ''],
    ['oversized meta', { ...valid, meta: { blob: 'x'.repeat(9000) } }, 'meta'],
    ['too long summary', { ...valid, summary: 'x'.repeat(2001) }, 'summary'],
  ])('rejects %s with 400', async (_name, body, path) => {
    const res = await app.request('/call-outcomes', json(body));
    expect(res.status).toBe(400);
    const out = await read(res);
    expect(out.error).toBe('validation_failed');
    expect(out.issues.map((i: { path: string }) => i.path)).toContain(path);
  });

  it('rejects a non-JSON body with 400', async () => {
    const res = await app.request('/call-outcomes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /call-outcomes/stats', () => {
  it('ports VoiceDesk stats: totals, buckets, last 24h, per agent', async () => {
    const all = await read(await app.request('/call-outcomes/stats'));
    expect(all.total).toBe(total);
    expect(all.converted + all.open + all.informational).toBe(total);
    expect(all.perAgent).toMatchObject({ dental: 3, receptionist: 5 });
    const dental = await read(await app.request('/call-outcomes/stats?agent=dental'));
    expect(dental).toMatchObject({ total: 3, converted: 3, open: 0 });
  });
});

describe('misc', () => {
  it('unknown routes return JSON 404', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await read(res)).toEqual({ error: 'not_found' });
  });

  it('/health reports db ok and the AI mode', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await read(res)).toEqual({ status: 'ok', db: 'ok', ai: 'mock' });
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { Db } from '../../src/db/client.js';
import { buildApp, json, read } from '../helpers/app.js';
import { createTestDb, type TestDb } from '../helpers/db.js';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.close());

describe('API_KEY bearer auth', () => {
  const app = () => buildApp(t.db, { apiKey: 'test-key' });

  it('rejects requests without or with a wrong token', async () => {
    expect((await app().request('/call-outcomes')).status).toBe(401);
    expect((await app().request('/call-outcomes/1')).status).toBe(401);
    expect((await app().request('/insights', json({}))).status).toBe(401);
    expect((await app().request('/call-outcomes', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
  });

  it('accepts the right token', async () => {
    const res = await app().request('/call-outcomes', { headers: { authorization: 'Bearer test-key' } });
    expect(res.status).toBe(200);
  });

  it('leaves /health open', async () => {
    expect((await app().request('/health')).status).toBe(200);
  });

  it('is off when no API_KEY is configured', async () => {
    expect((await buildApp(t.db).request('/call-outcomes')).status).toBe(200);
  });
});

describe('/health when the database is down', () => {
  it('returns 503 degraded', async () => {
    const broken = { execute: () => Promise.reject(new Error('connection refused')) } as unknown as Db;
    const app = createApp({ db: broken, resolveModels: () => [], aiMode: 'mock' });
    const res = await app.request('/health');
    expect(res.status).toBe(503);
    expect(await read(res)).toEqual({ status: 'degraded', db: 'error', ai: 'mock' });
  });
});

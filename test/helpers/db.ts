import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { Db } from '../../src/db/client.js';
import { createNodeDb, runMigrations } from '../../src/db/node.js';
import * as schema from '../../src/db/schema.js';

export interface TestDb {
  db: Db;
  kind: 'pglite' | 'postgres';
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Real Postgres when TEST_DATABASE_URL is set (CI service container, docker compose `postgres-test`),
 * otherwise PGlite: Postgres compiled to WASM, in-process, no docker. Both run the same drizzle/ migrations.
 */
export async function createTestDb(): Promise<TestDb> {
  const url = process.env.TEST_DATABASE_URL;
  let db: Db;
  let close: () => Promise<void>;
  let kind: TestDb['kind'];
  if (url) {
    await runMigrations(url);
    ({ db, close } = createNodeDb(url));
    kind = 'postgres';
  } else {
    const client = new PGlite();
    const pdb = drizzlePglite({ client, schema });
    await migratePglite(pdb, { migrationsFolder: 'drizzle' });
    db = pdb;
    close = () => client.close();
    kind = 'pglite';
  }
  const reset = async () => {
    await db.execute(sql`TRUNCATE call_outcomes, call_insights RESTART IDENTITY`);
  };
  await reset();
  return { db, kind, reset, close };
}

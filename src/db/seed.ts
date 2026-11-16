/**
 * Inserts SAMPLE (fake) call outcomes, flagged is_sample=true. Re-running replaces the previous
 * sample rows and never touches rows created through the API.
 */
import { eq } from 'drizzle-orm';
import { loadConfig } from '../config.js';
import { createNodeDb } from './node.js';
import { sampleRows } from './sample-data.js';
import { callOutcomes } from './schema.js';

const { databaseUrl } = loadConfig(process.env);
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const { db, close } = createNodeDb(databaseUrl);
try {
  const rows = sampleRows();
  await db.transaction(async (tx) => {
    await tx.delete(callOutcomes).where(eq(callOutcomes.isSample, true));
    await tx.insert(callOutcomes).values(rows);
  });
  console.log(`seeded ${rows.length} SAMPLE call outcomes (is_sample=true)`);
} finally {
  await close();
}

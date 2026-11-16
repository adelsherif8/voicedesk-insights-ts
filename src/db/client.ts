import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema.js';

/**
 * The app depends on this driver-agnostic type, not on a concrete driver. node-postgres (server),
 * PGlite (tests) and a Workers driver all produce a PgDatabase, so routes never import a driver.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

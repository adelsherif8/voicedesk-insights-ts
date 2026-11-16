import { loadConfig } from '../config.js';
import { runMigrations } from './node.js';

const { databaseUrl } = loadConfig(process.env);
if (!databaseUrl) throw new Error('DATABASE_URL is required');
await runMigrations(databaseUrl);
console.log('migrations applied');

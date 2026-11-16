import { defineConfig } from 'vitest/config';

// With TEST_DATABASE_URL set, every test file shares one real Postgres, so run files one at a time.
const sharedDb = Boolean(process.env.TEST_DATABASE_URL);

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    fileParallelism: !sharedDb,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: { OTEL_TRACES_EXPORTER: 'none' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Process entry points (they start servers / exit); their logic lives in covered modules.
      exclude: ['src/server.ts', 'src/worker.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});

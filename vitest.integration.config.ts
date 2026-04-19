import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@cf-wasm/resvg': path.resolve(import.meta.dirname, 'tests/helpers/stubs/resvg.ts'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/_global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    maxConcurrency: 1,
    pool: 'forks',
    fileParallelism: false,
  },
});

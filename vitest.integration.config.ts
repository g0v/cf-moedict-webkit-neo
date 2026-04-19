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
    coverage: {
      // Integration coverage is mostly empty because the worker + handlers
      // run inside Miniflare's workerd isolate, which vitest's v8 collector
      // can't see into. We keep coverage enabled only to expose any accidental
      // *direct* imports from tests/integration → src (e.g. shape helpers).
      // The handler files themselves get attribution from the direct-call
      // unit tests in tests/unit/api-handlers-direct.test.ts.
      provider: 'v8',
      reporter: ['text-summary', 'json', 'lcov'],
      reportsDirectory: 'coverage/integration',
      include: [
        'src/ssr/**/*.ts',
        'src/utils/**/*.ts',
        'src/api/**/*.ts',
      ],
      exclude: [
        'src/utils/image-generation.ts',
      ],
    },
  },
});

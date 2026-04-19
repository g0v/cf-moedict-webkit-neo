import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@cf-wasm/resvg': path.resolve(import.meta.dirname, 'tests/helpers/stubs/resvg.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/_setup.ts'],
    globals: false,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: {
      junit: 'unit-report.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
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

import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: 'reports/junit.xml',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'infrastructure/', '**/*.test.ts', '**/*.spec.ts'],
    },
    exclude: ['node_modules/', 'dist/', 'infrastructure/'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  esbuild: {
    target: 'es2022',
  },
});

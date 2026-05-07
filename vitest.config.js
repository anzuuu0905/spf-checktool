import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8', // c8 は v8 に統合されました
      reporter: ['text', 'html', 'json'],
      exclude: ['node_modules/', 'tests/', 'docs/', '*.config.js'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95
      }
    }
  }
});

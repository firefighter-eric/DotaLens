import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}', 'scripts/syncUtils.mjs', 'scripts/checkDeployment.mjs'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/data/**', 'src/i18n/**', 'src/main.jsx'],
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: {
        statements: 60,
        branches: 45,
        functions: 60,
        lines: 60,
      },
    },
  },
});

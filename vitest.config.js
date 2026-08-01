import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/App.jsx',
        'src/components/AccountModal.jsx',
        'src/components/CoachPanel.jsx',
        'src/components/HeroPerformanceTable.jsx',
        'src/components/RecentMatchDetailDrawer.jsx',
        'src/components/TeammatesPanel.jsx',
        'src/hooks/usePlayerAnalytics.js',
        'src/services/opendota.js',
        'src/services/opendotaClient.js',
        'src/utils/accountSession.js',
        'src/utils/coachInsights.js',
        'src/utils/date.js',
        'src/utils/metrics.js',
        'scripts/syncUtils.mjs',
      ],
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

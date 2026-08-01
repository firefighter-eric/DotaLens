import { describe, expect, it } from 'vitest';
import {
  formatHeroWinRate,
  resolveHeroWinRate,
  summarizeRecentMatches,
  summarizeSideWinRates,
} from './metrics.js';

describe('metrics outcome handling', () => {
  it('keeps an all-unknown hero win rate unavailable', () => {
    const hero = { matches: 5, outcomeMatches: 0, wins: 0, winRate: null };

    expect(resolveHeroWinRate(hero)).toBeNull();
    expect(formatHeroWinRate(hero, '-')).toBe('-');
  });

  it('excludes unknown outcomes from win-rate denominators', () => {
    const summary = summarizeRecentMatches([
      { result: 'win', kills: 5, deaths: 2, assists: 8, durationSec: 1800 },
      { result: 'loss', kills: 2, deaths: 5, assists: 4, durationSec: 1800 },
      { result: 'unknown', kills: 10, deaths: 1, assists: 10, durationSec: 1800 },
    ]);

    expect(summary).toMatchObject({
      total: 3,
      ratedTotal: 2,
      unknownResults: 1,
      wins: 1,
      winRate: '50.0',
    });
  });

  it('reports unavailable win rate when every outcome is unknown', () => {
    expect(
      summarizeRecentMatches([
        { result: 'unknown', kills: 2, deaths: 1, assists: 3, durationSec: 1200 },
      ])
    ).toMatchObject({
      total: 1,
      ratedTotal: 0,
      unknownResults: 1,
      wins: 0,
      winRate: null,
    });
  });

  it('excludes missing durations and KDA fields from their averages', () => {
    expect(
      summarizeRecentMatches([
        {
          result: 'win',
          kills: null,
          deaths: 1,
          assists: 3,
          durationSec: null,
        },
      ])
    ).toMatchObject({
      avgKda: null,
      avgDurationMin: null,
    });

    expect(
      summarizeRecentMatches([
        { result: 'win', kills: 1, deaths: 1, assists: 1, durationSec: 1200 },
        { result: 'loss', kills: 1, deaths: 1, assists: 1, durationSec: null },
      ])
    ).toMatchObject({
      avgKda: '2.00',
      avgDurationMin: 20,
    });
  });

  it('excludes unknown outcomes and missing slots from side win rates', () => {
    const sides = summarizeSideWinRates([
      { result: 'win', playerSlot: 0 },
      { result: 'loss', playerSlot: 129 },
      { result: 'unknown', playerSlot: 1 },
      { result: 'win', playerSlot: null },
    ]);

    expect(sides.radiant).toMatchObject({ matches: 1, wins: 1, winRate: '100.0' });
    expect(sides.dire).toMatchObject({ matches: 1, wins: 0, winRate: '0.0' });
  });
});

import { describe, expect, it } from 'vitest';
import { buildCoachInsights } from './coachInsights.js';

const makeMatch = (index, result = index % 2 === 0 ? 'win' : 'loss') => ({
  matchId: 1000 + index,
  result,
  deaths: index % 4 === 0 ? 9 : 5,
  heroId: index < 8 ? 1 : 2,
  hero: index < 8 ? 'Axe' : 'Puck',
});

describe('buildCoachInsights', () => {
  it('returns bounded evidence and transparent metadata', () => {
    const windowMatches = Array.from({ length: 20 }, (_, index) => makeMatch(index));
    const insights = buildCoachInsights({
      windowMatches,
      heroPerformance: [{ heroId: 1, hero: 'Axe', matches: 8, wins: 5 }],
    });

    expect(insights.map((item) => item.id)).toEqual(['momentum', 'survival', 'heroFocus']);
    insights.forEach((insight) => {
      expect(insight.formulaVersion).toBe('coach:v1');
      expect(insight.sampleSize).toBeGreaterThan(0);
      expect(insight.evidenceMatchIds.length).toBeLessThanOrEqual(3);
    });
  });

  it('does not manufacture insights from insufficient data', () => {
    expect(buildCoachInsights({ windowMatches: [makeMatch(1)] })).toEqual([]);
  });

  it('excludes unknown outcomes from momentum samples', () => {
    const windowMatches = [
      ...Array.from({ length: 10 }, (_, index) => makeMatch(index, 'win')),
      ...Array.from({ length: 10 }, (_, index) => makeMatch(index + 10, 'loss')),
      { ...makeMatch(99), result: 'unknown' },
    ];
    const [momentum] = buildCoachInsights({ windowMatches });

    expect(momentum.metrics.recentWinRate).toBe(100);
    expect(momentum.metrics.previousWinRate).toBe(0);
    expect(momentum.sampleSize).toBe(20);
  });

  it('uses only decided outcomes for hero focus confidence and win rate', () => {
    const insights = buildCoachInsights({
      windowMatches: [
        makeMatch(1, 'win'),
        makeMatch(2, 'loss'),
        { ...makeMatch(3), result: 'unknown' },
        { ...makeMatch(4), result: 'unknown' },
        { ...makeMatch(5), result: 'unknown' },
      ],
      heroPerformance: [
        { heroId: 1, hero: 'Axe', matches: 5, outcomeMatches: 2, wins: 1 },
      ],
    });

    expect(insights.find((insight) => insight.id === 'heroFocus')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildGameModeDistribution,
  buildHourlyMatchDistribution,
  buildRoleDistribution,
  summarizeDashboard,
  summarizeOverviewExtremes,
  summarizeRecentMatches,
  summarizeSideWinRates,
  toPercent,
} from '../src/utils/metrics.js';

describe('metrics', () => {
  it('formats percentages and handles an empty denominator', () => {
    expect(toPercent(2, 3)).toBe('66.7');
    expect(toPercent(1, 0)).toBe('0.0');
  });

  it('finds overview extremes with deterministic tie-breaking', () => {
    const matches = [
      {
        matchId: 10,
        startTime: 100,
        hero: 'Axe',
        heroDamage: 1200,
        kills: 8,
        deaths: 4,
        assists: 3,
        result: 'win',
      },
      {
        matchId: 12,
        startTime: 200,
        hero: 'Lina',
        heroDamage: 1200,
        kills: 8,
        deaths: 9,
        assists: '7',
        result: 'loss',
      },
      {
        matchId: 13,
        startTime: 200,
        hero: 'Lion',
        heroDamage: null,
        kills: 8,
        deaths: 2,
        assists: 10,
        result: 'win',
      },
    ];

    const result = summarizeOverviewExtremes(matches);
    expect(result.highestDamageMatch).toMatchObject({ matchId: 12, value: 1200 });
    expect(result.mostKillsMatch).toMatchObject({ matchId: 13, value: 8 });
    expect(result.mostDeathsMatch).toMatchObject({ matchId: 12, value: 9, assists: 7 });
    expect(summarizeOverviewExtremes()).toEqual({
      highestDamageMatch: null,
      mostKillsMatch: null,
      mostDeathsMatch: null,
    });
  });

  it('summarizes dashboard totals, weighted averages, heroes, and streaks', () => {
    const heroes = [
      {
        hero: 'Axe',
        heroAvatar: '/axe.png',
        role: 'Core',
        matches: 10,
        wins: 6,
        kills: 50,
        deaths: 25,
        assists: 75,
        avgGpm: 500,
        avgXpm: 600,
        impact: 9,
      },
      {
        hero: 'Lion',
        role: 'Support',
        matches: 5,
        wins: 1,
        kills: 10,
        deaths: 20,
        assists: 20,
        avgGpm: 400,
        avgXpm: 450,
        impact: 2,
      },
    ];
    const matches = [
      { matchId: 1, startTime: 1, result: 'win' },
      { matchId: 2, startTime: 2, result: 'win' },
      { matchId: 3, startTime: 3, result: 'abandoned' },
      { matchId: 4, startTime: 4, result: 'loss' },
      { matchId: 5, startTime: 5, result: 'loss' },
      { matchId: 6, startTime: 6, result: 'loss' },
    ];

    const result = summarizeDashboard(heroes, matches);
    expect(result).toMatchObject({
      totalMatches: 15,
      overallWinRate: '46.7',
      avgKda: '3.44',
      avgGpm: 467,
      avgXpm: 550,
      longestWinStreak: 2,
      longestLossStreak: 3,
      bestHero: { hero: 'Axe' },
      worstHero: { hero: 'Lion' },
      mostPlayedHero: { hero: 'Axe', matches: 10, winRate: '60.0' },
    });
  });

  it('returns stable dashboard defaults for no hero data', () => {
    const result = summarizeDashboard([], [{ result: 'win' }, { result: 'loss' }]);
    expect(result).toMatchObject({
      totalMatches: 0,
      overallWinRate: null,
      avgKda: null,
      avgGpm: null,
      longestWinStreak: 1,
      longestLossStreak: 1,
      bestHero: { hero: '-' },
      worstHero: { hero: '-' },
    });
  });

  it('builds sorted role distribution and handles zero totals', () => {
    expect(
      buildRoleDistribution([
        { role: 'Core', matches: 10 },
        { role: 'Support', matches: 5 },
        { matches: 0 },
      ])
    ).toEqual([
      { role: 'Core', matches: 10, ratio: 66.7 },
      { role: 'Support', matches: 5, ratio: 33.3 },
      { role: '-', matches: 0, ratio: 0 },
    ]);
    expect(buildRoleDistribution([])).toEqual([]);
    expect(buildRoleDistribution([{ role: 'Core', matches: 0 }])).toEqual([]);
  });

  it('summarizes radiant and dire win rates while ignoring invalid rows', () => {
    expect(
      summarizeSideWinRates([
        { playerSlot: 1, result: 'win' },
        { playerSlot: 2, result: 'loss' },
        { playerSlot: 130, result: 'win' },
        { playerSlot: null, result: 'win' },
        { playerSlot: 140, result: 'unknown' },
      ])
    ).toEqual({
      radiant: { wins: 1, matches: 2, winRate: '50.0' },
      dire: { wins: 1, matches: 1, winRate: '100.0' },
    });
    expect(summarizeSideWinRates(null).dire.winRate).toBeNull();
  });

  it('summarizes recent matches and optional GPM', () => {
    expect(
      summarizeRecentMatches([
        {
          result: 'win',
          kills: 10,
          deaths: 2,
          assists: 8,
          goldPerMin: 500,
          durationSec: 1800,
        },
        {
          result: 'loss',
          kills: 2,
          deaths: 8,
          assists: 4,
          durationSec: 2400,
        },
      ])
    ).toEqual({
      total: 2,
      ratedTotal: 2,
      unknownResults: 0,
      wins: 1,
      winRate: '50.0',
      avgKda: '2.40',
      avgGpm: 500,
      avgDurationMin: 35,
    });
    expect(summarizeRecentMatches([])).toMatchObject({ total: 0, avgGpm: null });
  });

  it('builds a local-hour histogram and ignores invalid timestamps', () => {
    const atHour = (hour) => new Date(2026, 0, 1, hour, 0, 0).getTime() / 1000;
    const result = buildHourlyMatchDistribution([
      { startTime: atHour(8) },
      { startTime: atHour(8) },
      { startTime: atHour(20) },
      { startTime: 0 },
      { startTime: 'invalid' },
    ]);

    expect(result).toHaveLength(24);
    expect(result[8]).toEqual({ hour: 8, matches: 2, ratio: 66.7 });
    expect(result[20]).toEqual({ hour: 20, matches: 1, ratio: 33.3 });
    expect(buildHourlyMatchDistribution(null).every((entry) => entry.ratio === 0)).toBe(true);
  });

  it('builds a deterministic game-mode distribution with an unknown bucket', () => {
    expect(
      buildGameModeDistribution(
        [{ gameMode: 'Turbo' }, { gameMode: ' All Pick ' }, {}, { gameMode: 'Turbo' }],
        'Unknown mode'
      )
    ).toEqual([
      { mode: 'Turbo', matches: 2, ratio: 50 },
      { mode: 'All Pick', matches: 1, ratio: 25 },
      { mode: 'Unknown mode', matches: 1, ratio: 25 },
    ]);
    expect(buildGameModeDistribution(null)).toEqual([]);
  });
});

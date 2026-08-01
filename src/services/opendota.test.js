import { describe, expect, it } from 'vitest';
import { openDotaTesting } from './opendota.js';

const {
  buildAchievementTotalsFromMatches,
  buildDailyKdaTrend,
  buildDailyWinRate,
  buildHeroPerformance,
  buildMatchRows,
  buildRankDistribution,
  createWindowBoundary,
  mergeAchievementTotals,
  resolveCurrentPlayer,
  resolveImpactScore,
  resolveMatchOutcome,
  resolveOwnedItemTiming,
  summarizeKnownOutcomeDashboard,
} = openDotaTesting;

const zhLocale = {
  rankTierMap: {
    1: '先锋',
    2: '卫士',
    3: '中军',
    4: '统帅',
    5: '传奇',
    6: '万古流芳',
    7: '超凡入圣',
    8: '冠绝一世',
  },
  skillMap: {
    1: '普通',
    2: '高端',
    3: '超高端',
  },
};

const toStartTime = (year, month, day, hour = 12) =>
  Math.floor(new Date(year, month, day, hour).getTime() / 1000);

describe('OpenDota aggregation contracts', () => {
  it('keeps outcome-dependent impact unavailable when the match result is unknown', () => {
    expect(resolveImpactScore('unknown', 5, 600, 70)).toBeNull();
    expect(resolveImpactScore('win', 5, 600, 70)).toBeGreaterThan(
      resolveImpactScore('loss', 5, 600, 70)
    );
  });

  it('does not score an all-unknown hero as a zero-percent performer', () => {
    const [hero] = buildHeroPerformance(
      [
        {
          hero_id: 1,
          player_slot: null,
          radiant_win: true,
          kills: 3,
          deaths: 2,
          assists: 4,
          gold_per_min: 500,
          xp_per_min: 600,
        },
      ],
      new Map([
        [
          1,
          {
            name: 'Axe',
            primaryAttr: 'str',
          },
        ],
      ]),
      {
        ...zhLocale,
        laneRoleMap: {},
        attributeMap: { str: '力量' },
        unknownRole: '未标注',
        unknownAttribute: '未标注',
      }
    );

    expect(hero).toMatchObject({
      matches: 1,
      outcomeMatches: 0,
      unknownOutcomes: 1,
      wins: 0,
      losses: 0,
      winRate: null,
      impact: null,
    });
  });

  it('keeps incomplete KDA samples out of aggregates and trend denominators', () => {
    const [hero] = buildHeroPerformance(
      [
        {
          hero_id: 1,
          player_slot: 0,
          radiant_win: true,
          kills: 3,
          deaths: null,
          assists: 4,
        },
      ],
      new Map(),
      {
        ...zhLocale,
        laneRoleMap: {},
        attributeMap: {},
        unknownRole: '未标注',
        unknownAttribute: '未标注',
      }
    );

    expect(hero).toMatchObject({
      matches: 1,
      kdaMatches: 0,
      avgKda: null,
      impact: null,
    });

    const boundary = createWindowBoundary(30, new Date(2026, 6, 31, 12));
    const point = buildDailyKdaTrend(
      [
        {
          start_time: toStartTime(2026, 6, 31),
          kills: 3,
          deaths: null,
          assists: 4,
        },
      ],
      boundary
    ).find((entry) => entry.date === '2026-07-31');

    expect(point).toMatchObject({
      value: null,
      sampleCount: 0,
      observedMatches: 1,
      isGap: true,
    });
  });

  it('drops malformed timestamps before creating renderable match rows', () => {
    const rows = buildMatchRows(
      [
        { match_id: 1, start_time: 'broken', hero_id: 1 },
        { match_id: 2, start_time: Number.MAX_VALUE, hero_id: 1 },
        { match_id: 3, start_time: '1710000000', hero_id: 1 },
      ],
      new Map(),
      {
        ...zhLocale,
        laneRoleMap: {},
        gameModeMap: {},
        lobbyTypeMap: {},
        unknownRole: '未标注',
        unknownMode: '未知模式',
        unknownQueue: '未知队列',
        unknownRank: '未知',
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      matchId: 3,
      startTime: 1710000000,
    });
  });

  it('requires at least two known outcomes for rate-ranked hero claims', () => {
    const hero = {
      hero: 'Axe',
      heroAvatar: '',
      matches: 10,
      outcomeMatches: 1,
      unknownOutcomes: 9,
      wins: 1,
      losses: 0,
      winRate: 100,
      kills: 5,
      deaths: 2,
      assists: 8,
      kdaMatches: 1,
      avgKda: 6.5,
      avgGpm: 500,
      gpmMatches: 1,
      avgXpm: 600,
      xpmMatches: 1,
      impact: 99,
    };
    const metrics = summarizeKnownOutcomeDashboard(
      [hero],
      [
        { result: 'win' },
        ...Array.from({ length: 9 }, () => ({ result: 'unknown' })),
      ]
    );

    expect(metrics.mostPlayedHero).toMatchObject({
      hero: 'Axe',
      matches: 10,
      outcomeMatches: 1,
      winRate: '100.0',
    });
    expect(metrics.worstHero.hero).toBe('-');
    expect(metrics.signatureHero.hero).toBe('-');
    expect(metrics.antiSignatureHero.hero).toBe('-');
  });

  it('keeps nullable outcomes unknown and excludes them from win-rate samples', () => {
    expect(resolveMatchOutcome(0, true)).toBe('win');
    expect(resolveMatchOutcome(0, false)).toBe('loss');
    expect(resolveMatchOutcome(128, false)).toBe('win');
    expect(resolveMatchOutcome(128, true)).toBe('loss');
    expect(resolveMatchOutcome(0, null)).toBe('unknown');
    expect(resolveMatchOutcome(null, true)).toBe('unknown');
  });

  it('preserves empty-day gaps and computes rolling win rate from match-weighted totals', () => {
    const boundary = createWindowBoundary(30, new Date(2026, 6, 31, 12));
    const series = buildDailyWinRate(
      [
        { start_time: toStartTime(2026, 6, 29), player_slot: 0, radiant_win: true },
        { start_time: toStartTime(2026, 6, 29), player_slot: 0, radiant_win: false },
        { start_time: toStartTime(2026, 6, 31), player_slot: 0, radiant_win: true },
        { start_time: toStartTime(2026, 6, 31, 13), player_slot: 0, radiant_win: null },
      ],
      boundary
    );

    const july29 = series.find((point) => point.date === '2026-07-29');
    const july30 = series.find((point) => point.date === '2026-07-30');
    const july31 = series.find((point) => point.date === '2026-07-31');

    expect(july29).toMatchObject({
      value: 50,
      rawValue: 50,
      sampleCount: 2,
      windowSampleCount: 2,
      isGap: false,
    });
    expect(july30).toMatchObject({
      value: null,
      rawValue: null,
      sampleCount: 0,
      isGap: true,
    });
    expect(july31).toMatchObject({
      value: 67,
      rawValue: 100,
      sampleCount: 1,
      windowSampleCount: 3,
      observedMatches: 2,
      unknownOutcomeCount: 1,
      rollingWindow: 3,
      isGap: false,
    });
  });

  it('reports achievement coverage instead of treating one populated row as complete', () => {
    const fromMatches = buildAchievementTotalsFromMatches([
      {
        multi_kills: { 5: 1 },
        kill_streaks: { 9: 1 },
      },
      {},
    ]);
    const totals = mergeAchievementTotals(null, fromMatches);

    expect(totals).toMatchObject({
      rampage: 1,
      godlike: 1,
      rampageDataAvailable: false,
      godlikeDataAvailable: false,
      rampagePartialDataAvailable: true,
      godlikePartialDataAvailable: true,
    });
    expect(totals.rampageCoverage).toEqual({
      availableMatches: 1,
      totalMatches: 2,
      ratio: 0.5,
      complete: false,
    });
  });

  it('identifies the current player by account, then slot, then a unique hero', () => {
    const players = [
      { account_id: 11, player_slot: 0, hero_id: 1 },
      { account_id: 22, player_slot: 1, hero_id: 2 },
    ];

    expect(resolveCurrentPlayer(players, { accountId: 22, playerSlot: 0, heroId: 1 })).toMatchObject({
      player: players[1],
      matchedBy: 'accountId',
      ambiguous: false,
    });
    expect(resolveCurrentPlayer(players, { accountId: 99, playerSlot: 0, heroId: 2 })).toMatchObject({
      player: players[0],
      matchedBy: 'playerSlot',
      ambiguous: false,
    });
    expect(
      resolveCurrentPlayer(
        [
          ...players,
          { account_id: null, player_slot: 2, hero_id: 2 },
        ],
        { accountId: 99, heroId: 2 }
      )
    ).toMatchObject({
      player: null,
      matchedBy: null,
      ambiguous: true,
    });
  });

  it('does not turn an owned-but-untimed scepter or shard into a 00:00 purchase', () => {
    expect(resolveOwnedItemTiming([], ['aghanims_scepter'], true)).toEqual({
      owned: true,
      acquiredAt: null,
      timingAvailable: false,
      timingSource: 'unknown',
    });
    expect(
      resolveOwnedItemTiming(
        [{ rawKey: 'aghanims_shard', timeSec: 1432 }],
        ['aghanims_shard'],
        false
      )
    ).toEqual({
      owned: true,
      acquiredAt: 1432,
      timingAvailable: true,
      timingSource: 'purchase_log',
    });
  });

  it('keeps match-average rank and skill bracket as separate distributions', () => {
    const rankData = buildRankDistribution(
      [
        { average_rank: 54, rank_tier: 80, skill: 3 },
        { average_rank: null, rank_tier: 80, skill: 2 },
      ],
      zhLocale
    );

    expect(rankData.matchAverageRankDistribution).toEqual([
      { tier: '传奇', count: 1, ratio: 100 },
    ]);
    expect(rankData.matchAverageRankCoverage).toMatchObject({
      availableMatches: 1,
      totalMatches: 2,
      ratio: 0.5,
    });
    expect(rankData.skillBracketDistribution).toEqual([
      { tier: '超高端', count: 1, ratio: 50 },
      { tier: '高端', count: 1, ratio: 50 },
    ]);
  });
});

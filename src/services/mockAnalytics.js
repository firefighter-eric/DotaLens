import { dailyGpmTrend, dailyKdaTrend, dailyWinRate, dailyXpmTrend, heroPerformance, rankDistribution, recentMatches } from '../data/mockDotaData.js';
import { heroCatalog } from '../data/heroCatalog.js';
import { summarizeDashboard } from '../utils/metrics.js';

const MOCK_ATTRIBUTE_LABEL = {
  zh: {
    Strength: '力量',
    Agility: '敏捷',
    Intelligence: '智力',
    Universal: '全才',
    Unlabeled: '未标注',
  },
  en: {
    Strength: 'Strength',
    Agility: 'Agility',
    Intelligence: 'Intelligence',
    Universal: 'Universal',
    Unlabeled: 'Unlabeled',
  },
};

const MOCK_GAME_MODE_LABEL = {
  zh: '全英雄选择',
  en: 'All Pick',
};

const localizeMockAttribute = (attribute, lang) => {
  const locale = lang === 'en' ? 'en' : 'zh';
  return MOCK_ATTRIBUTE_LABEL[locale][attribute] ?? MOCK_ATTRIBUTE_LABEL[locale].Unlabeled;
};

const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const calculateKda = (kills, deaths, assists) =>
  Number((((kills ?? 0) + (assists ?? 0)) / Math.max(1, deaths ?? 0)).toFixed(2));

export const createMockDashboard = (copy, lang = 'zh') => {
  const localizedHeroPerformance = heroPerformance.map((hero) => {
    const entry = heroCatalog.find((item) => item.nameEn === hero.hero);
    const attribute = { str: 'Strength', agi: 'Agility', int: 'Intelligence', all: 'Universal' }[entry?.primaryAttr] ?? hero.attribute;
    return { ...hero, heroId: entry?.id, primaryAttr: entry?.primaryAttr,
      heroAvatar: entry?.avatar ?? hero.heroAvatar,
      hero: lang === 'en' ? entry?.nameEn ?? hero.hero : entry?.nameZh ?? hero.hero,
      attribute: localizeMockAttribute(attribute, lang) };
  });
  const localizedRecentMatches = recentMatches.map((match) => ({
    ...match,
    hero: heroCatalog.find((hero) => hero.id === match.heroId)?.[lang === 'en' ? 'nameEn' : 'nameZh'] ?? match.hero,
    heroAvatar: heroCatalog.find((hero) => hero.id === match.heroId)?.avatar ?? match.heroAvatar,
    playerSlot: match.playerSlot ?? (match.matchId % 2 === 0 ? 0 : 128),
    gameMode: match.gameMode ?? MOCK_GAME_MODE_LABEL[lang === 'en' ? 'en' : 'zh'],
  }));
  const metrics = summarizeDashboard(localizedHeroPerformance, localizedRecentMatches);
  const achievementTotals = localizedRecentMatches.reduce(
    (acc, match) => {
      const rampageCount = toFiniteOrNull(match?.rampageCount);
      const godlikeCount = toFiniteOrNull(match?.godlikeCount);
      acc.rampage += rampageCount == null ? (match?.hasRampage ? 1 : 0) : Math.max(0, Math.trunc(rampageCount));
      acc.godlike += godlikeCount == null ? (match?.hasGodlike ? 1 : 0) : Math.max(0, Math.trunc(godlikeCount));
      return acc;
    },
    { rampage: 0, godlike: 0, rampageDataAvailable: true, godlikeDataAvailable: true }
  );
  const completeCoverage = {
    availableMatches: localizedRecentMatches.length,
    totalMatches: localizedRecentMatches.length,
    ratio: 1,
    complete: true,
  };
  achievementTotals.rampageCoverage = completeCoverage;
  achievementTotals.godlikeCoverage = completeCoverage;
  achievementTotals.rampagePartialDataAvailable = false;
  achievementTotals.godlikePartialDataAvailable = false;
  const teammates = [
    {
      accountId: 1,
      playerName: lang === 'en' ? 'Teammate A' : '队友 A',
      playerAvatar: '',
      matches: 28,
      wins: 16,
      losses: 12,
      winRate: 57.1,
      avgKda: 3.46,
      avgGpm: 512,
      avgXpm: 602,
      againstMatches: 11,
      againstWins: 6,
      againstWinRate: 54.5,
      lastPlayed: 1735603200,
    },
    {
      accountId: 2,
      playerName: lang === 'en' ? 'Teammate B' : '队友 B',
      playerAvatar: '',
      matches: 26,
      wins: 19,
      losses: 7,
      winRate: 73.1,
      avgKda: 4.12,
      avgGpm: 558,
      avgXpm: 645,
      againstMatches: 10,
      againstWins: 3,
      againstWinRate: 30,
      lastPlayed: 1737062400,
    },
    {
      accountId: 3,
      playerName: lang === 'en' ? 'Teammate C' : '队友 C',
      playerAvatar: '',
      matches: 22,
      wins: 7,
      losses: 15,
      winRate: 31.8,
      avgKda: 2.21,
      avgGpm: 441,
      avgXpm: 521,
      againstMatches: 13,
      againstWins: 9,
      againstWinRate: 69.2,
      lastPlayed: 1732233600,
    },
    {
      accountId: 4,
      playerName: lang === 'en' ? 'Teammate D' : '队友 D',
      playerAvatar: '',
      matches: 18,
      wins: 10,
      losses: 8,
      winRate: 55.6,
      avgKda: 3.01,
      avgGpm: 486,
      avgXpm: 575,
      againstMatches: 6,
      againstWins: 2,
      againstWinRate: 33.3,
      lastPlayed: 1734480000,
    },
  ];
  return {
    source: 'mock',
    playerName: copy.misc.samplePlayerName,
    playerAvatar: '',
    totalMatches: metrics.totalMatches,
    heroPerformance: localizedHeroPerformance,
    dailyWinRate,
    dailyKdaTrend,
    dailyGpmTrend,
    dailyXpmTrend,
    rankDistribution,
    recentMatches: localizedRecentMatches,
    windowMatches: localizedRecentMatches,
    metrics,
    achievementTotals,
    teammates,
    teammateSummary: {
      mostPlayed: teammates[0],
      worstWinRateOver20: teammates[2],
      bestWinRateOver20: teammates[1],
    },
  };
};

export const createMockRecentMatchDetail = (match, lang) => {
  const normalizedGpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : 0;
  const normalizedXpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : 0;
  const normalizedKda = calculateKda(match.kills, match.deaths, match.assists);
  const rampageCount = Number.isFinite(match.rampageCount) ? Math.max(0, Math.trunc(match.rampageCount)) : match.hasRampage ? 1 : 0;
  const godlikeCount = Number.isFinite(match.godlikeCount) ? Math.max(0, Math.trunc(match.godlikeCount)) : match.hasGodlike ? 1 : 0;
  const killParticipation = Math.min(95, Math.max(18, normalizedKda * 12));

  const isZh = lang !== 'en';
  const purchaseTimeline = [
    { id: 'mock-1', timeSec: 0, item: isZh ? '起始装组合' : 'Starting Set' },
    { id: 'mock-2', timeSec: 360, item: isZh ? '基础鞋' : 'Basic Boots' },
    { id: 'mock-3', timeSec: 780, item: isZh ? '核心道具 1' : 'Core Item 1' },
    { id: 'mock-4', timeSec: 1260, item: isZh ? '核心道具 2' : 'Core Item 2' },
    { id: 'mock-5', timeSec: 1680, item: isZh ? '后期道具' : 'Late Game Item' },
  ];

  const skillBuild = [
    { id: 'mock-s1', level: 1, ability: isZh ? '技能 1' : 'Ability 1', timeSec: 0 },
    { id: 'mock-s2', level: 2, ability: isZh ? '技能 2' : 'Ability 2', timeSec: 75 },
    { id: 'mock-s3', level: 3, ability: isZh ? '技能 1' : 'Ability 1', timeSec: 165 },
    { id: 'mock-s4', level: 4, ability: isZh ? '技能 3' : 'Ability 3', timeSec: 260 },
    { id: 'mock-s5', level: 5, ability: isZh ? '技能 1' : 'Ability 1', timeSec: 360 },
    { id: 'mock-s6', level: 6, ability: isZh ? '大招' : 'Ultimate', timeSec: 500 },
  ];

  const impactScore = Math.max(
    0,
    Math.min(99, Math.round((match.result === 'win' ? 14 : 0) + normalizedKda * 9 + normalizedGpm / 12 + killParticipation * 0.28))
  );
  const mockPlayers = [
    {
      id: 'mock-player-1',
      playerName: isZh ? '你' : 'You',
      team: 'radiant',
      hero: match.hero,
      heroAvatar: match.heroAvatar,
      laneRole: match.laneRole,
      rank: match.rank,
      kills: match.kills,
      deaths: match.deaths,
      assists: match.assists,
      goldPerMin: Number.isFinite(match.goldPerMin) ? match.goldPerMin : 0,
      xpPerMin: Number.isFinite(match.xpPerMin) ? match.xpPerMin : 0,
      lastHits: Math.round(normalizedGpm * (match.durationSec / 60 / 12)),
      denies: Math.round(normalizedGpm / 55),
      netWorth: Math.round(normalizedGpm * (match.durationSec / 60)),
      heroDamage: Math.round(normalizedGpm * 40 + normalizedXpm * 5),
      towerDamage: Math.round(normalizedGpm * 6),
      heroHealing: Math.round(normalizedXpm * 3),
      isCurrentPlayer: true,
    },
    { id: 'mock-player-2', playerName: isZh ? '队友 A' : 'Teammate A', team: 'radiant', hero: 'Invoker', kills: 9, deaths: 5, assists: 12, goldPerMin: 598, xpPerMin: 644, lastHits: 201, denies: 12, netWorth: 24890, heroDamage: 35600, towerDamage: 3900, heroHealing: 120 },
    { id: 'mock-player-3', playerName: isZh ? '队友 B' : 'Teammate B', team: 'radiant', hero: 'Mars', kills: 6, deaths: 6, assists: 14, goldPerMin: 488, xpPerMin: 571, lastHits: 132, denies: 6, netWorth: 20130, heroDamage: 21900, towerDamage: 4500, heroHealing: 0 },
    { id: 'mock-player-4', playerName: isZh ? '队友 C' : 'Teammate C', team: 'radiant', hero: 'Rubick', kills: 4, deaths: 7, assists: 16, goldPerMin: 372, xpPerMin: 503, lastHits: 62, denies: 2, netWorth: 15620, heroDamage: 14300, towerDamage: 1200, heroHealing: 400 },
    { id: 'mock-player-5', playerName: isZh ? '队友 D' : 'Teammate D', team: 'radiant', hero: 'Oracle', kills: 2, deaths: 5, assists: 14, goldPerMin: 341, xpPerMin: 462, lastHits: 38, denies: 1, netWorth: 14210, heroDamage: 9200, towerDamage: 600, heroHealing: 12100 },
    { id: 'mock-player-6', playerName: isZh ? '对手 A' : 'Opponent A', team: 'dire', hero: 'Phantom Assassin', kills: 11, deaths: 7, assists: 10, goldPerMin: 617, xpPerMin: 653, lastHits: 223, denies: 13, netWorth: 26010, heroDamage: 33800, towerDamage: 3100, heroHealing: 0 },
    { id: 'mock-player-7', playerName: isZh ? '对手 B' : 'Opponent B', team: 'dire', hero: 'Lina', kills: 8, deaths: 8, assists: 14, goldPerMin: 512, xpPerMin: 590, lastHits: 151, denies: 9, netWorth: 21250, heroDamage: 29400, towerDamage: 2100, heroHealing: 0 },
    { id: 'mock-player-8', playerName: isZh ? '对手 C' : 'Opponent C', team: 'dire', hero: 'Underlord', kills: 5, deaths: 9, assists: 16, goldPerMin: 444, xpPerMin: 530, lastHits: 121, denies: 5, netWorth: 18900, heroDamage: 17300, towerDamage: 2400, heroHealing: 0 },
    { id: 'mock-player-9', playerName: isZh ? '对手 D' : 'Opponent D', team: 'dire', hero: 'Disruptor', kills: 3, deaths: 10, assists: 18, goldPerMin: 335, xpPerMin: 470, lastHits: 36, denies: 1, netWorth: 13980, heroDamage: 12900, towerDamage: 430, heroHealing: 0 },
    { id: 'mock-player-10', playerName: isZh ? '对手 E' : 'Opponent E', team: 'dire', hero: 'Warlock', kills: 2, deaths: 9, assists: 16, goldPerMin: 322, xpPerMin: 456, lastHits: 34, denies: 0, netWorth: 13450, heroDamage: 8700, towerDamage: 380, heroHealing: 9800 },
  ].map((player) => ({
    ...player,
    kda: calculateKda(player.kills, player.deaths, player.assists),
  }));

  return {
    matchId: match.matchId,
    heroId: match.heroId,
    hero: match.hero,
    heroAvatar: match.heroAvatar,
    overview: {
      result: match.result,
      startTime: match.startTime,
      durationSec: match.durationSec,
      gameMode: isZh ? '全英雄选择' : 'All Pick',
      queueType: isZh ? '天梯' : 'Ranked',
      laneRole: match.laneRole,
      rank: match.rank,
      kills: match.kills,
      deaths: match.deaths,
      assists: match.assists,
      kda: normalizedKda,
      goldPerMin: Number.isFinite(match.goldPerMin) ? match.goldPerMin : null,
      xpPerMin: Number.isFinite(match.xpPerMin) ? match.xpPerMin : null,
      killParticipation: Number(killParticipation.toFixed(1)),
      impactScore,
      rampageCount,
      godlikeCount,
      hasRampage: rampageCount > 0,
      hasGodlike: godlikeCount > 0,
      rampageDataAvailable: true,
      godlikeDataAvailable: true,
    },
    core: {
      heroDamage: Math.round(normalizedGpm * 40 + normalizedXpm * 5),
      towerDamage: Math.round(normalizedGpm * 6),
      heroHealing: Math.round(normalizedXpm * 3),
      stunDuration: Number((normalizedKda * 4.2).toFixed(1)),
      lastHits: Math.round(normalizedGpm * (match.durationSec / 60 / 12)),
      denies: Math.round(normalizedGpm / 55),
      netWorth: Math.round(normalizedGpm * (match.durationSec / 60)),
      level: 25,
    },
    build: {
      finalItems: isZh
        ? ['核心道具 1', '核心道具 2', '保命装', '功能装', '后期道具']
        : ['Core Item 1', 'Core Item 2', 'Defensive Item', 'Utility Item', 'Late Game Item'],
      neutralItem: isZh ? '中立道具示例' : 'Sample Neutral Item',
      purchaseTimeline,
      skillBuild,
      scepterTimeSec: 1320,
      shardTimeSec: 1620,
    },
    allPlayers: mockPlayers,
  };
};

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import StatCard from './components/StatCard.jsx';
import WinRateTrend from './components/WinRateTrend.jsx';
import HourlyMatchTrend from './components/HourlyMatchTrend.jsx';
import HeroPerformanceTable from './components/HeroPerformanceTable.jsx';
import RankDistribution from './components/RankDistribution.jsx';
import GameModeDistributionPie from './components/GameModeDistributionPie.jsx';
import RecentMatchesPanel from './components/RecentMatchesPanel.jsx';
import RecentMatchDetailDrawer from './components/RecentMatchDetailDrawer.jsx';
import TeammatesPanel from './components/TeammatesPanel.jsx';
import CoachPanel from './components/CoachPanel.jsx';
import OverviewHeroFocus from './components/OverviewHeroFocus.jsx';
import OverviewRecentMatches from './components/OverviewRecentMatches.jsx';
import AccountModal from './components/AccountModal.jsx';
import { dailyGpmTrend, dailyKdaTrend, dailyWinRate, dailyXpmTrend, heroPerformance, rankDistribution, recentMatches } from './data/mockDotaData.js';
import {
  buildGameModeDistribution,
  buildHourlyMatchDistribution,
  resolveHeroWinRate,
  summarizeDashboard,
  summarizeOverviewExtremes,
  summarizeRecentMatches,
  summarizeSideWinRates,
} from './utils/metrics.js';
import { fetchRecentMatchDetail } from './services/opendota.js';
import { createOpenDotaClient, invalidateOpenDotaCache } from './services/opendotaClient.js';
import { getCopy } from './i18n/copy.js';
import { createAnalyticsQueryKey, usePlayerAnalytics } from './hooks/usePlayerAnalytics.js';
import { buildCoachInsights } from './utils/coachInsights.js';
import { toValidUnixDate } from './utils/date.js';
import {
  isSameAccount,
  loadAccountSession,
  MAX_SAVED_ACCOUNTS,
  parseSteam32,
  saveAccountSession,
} from './utils/accountSession.js';

const CatalogTab = lazy(() => import('./components/CatalogTab.jsx'));

const RECENT_MATCHES_PAGE_SIZE = 30;
const TAB_IDS = {
  overview: 'overview',
  trend: 'trend',
  heroes: 'heroes',
  teammates: 'teammates',
  recentMatches: 'recentMatches',
  allHeroes: 'allHeroes',
  allItems: 'allItems',
};
const NAV_GROUPS = [
  { id: 'home', tabs: [TAB_IDS.overview] },
  { id: 'matches', tabs: [TAB_IDS.recentMatches] },
  { id: 'improve', tabs: [TAB_IDS.heroes, TAB_IDS.teammates, TAB_IDS.trend] },
  { id: 'library', tabs: [TAB_IDS.allHeroes, TAB_IDS.allItems] },
];

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

const createMockDashboard = (copy, lang = 'zh') => {
  const localizedHeroPerformance = heroPerformance.map((hero) => ({
    ...hero,
    attribute: localizeMockAttribute(hero.attribute, lang),
  }));
  const localizedRecentMatches = recentMatches.map((match) => ({
    ...match,
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

const formatMatchDate = (startTime, lang) => {
  const date = toValidUnixDate(startTime);
  if (!date) {
    return '';
  }

  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const formatIntegerDisplay = (value, lang, fallback) => {
  const number = toFiniteOrNull(value);
  if (number === null) {
    return fallback;
  }
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.NumberFormat(locale).format(Math.round(number));
};

const formatMatchDateTime = (startTime, lang, fallback) => {
  const date = toValidUnixDate(startTime);
  if (!date) {
    return fallback;
  }
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const formatEntryValue = (value, fallback) => {
  const number = toFiniteOrNull(value);
  return number === null ? fallback : String(Math.round(number));
};

const getAvatarInitial = (value, fallback = '?') => {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }
  return text.slice(0, 1).toUpperCase();
};

const createMockRecentMatchDetail = (match, lang) => {
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

const compareHeroes = (a, b, sortKey, sortDir, lang) => {
  const factor = sortDir === 'asc' ? 1 : -1;
  const locale = lang === 'en' ? 'en' : 'zh';

  const getValue = (hero) => {
    if (sortKey === 'hero') {
      return hero.hero;
    }
    if (sortKey === 'attribute') {
      return hero.attribute ?? '';
    }
    if (sortKey === 'matches') {
      return hero.matches;
    }
    if (sortKey === 'winRate') {
      return resolveHeroWinRate(hero);
    }
    if (sortKey === 'avgKda') {
      return hero.avgKda;
    }
    if (sortKey === 'avgGpm') {
      return Number.isFinite(hero.avgGpm) ? hero.avgGpm : null;
    }
    if (sortKey === 'avgXpm') {
      return Number.isFinite(hero.avgXpm) ? hero.avgXpm : null;
    }
    return hero.impact;
  };

  const av = getValue(a);
  const bv = getValue(b);
  const aMissing = av == null || (typeof av === 'number' && !Number.isFinite(av));
  const bMissing = bv == null || (typeof bv === 'number' && !Number.isFinite(bv));
  if (aMissing || bMissing) {
    if (aMissing !== bMissing) {
      return aMissing ? 1 : -1;
    }
    return a.hero.localeCompare(b.hero, locale);
  }

  if (typeof av === 'string' && typeof bv === 'string') {
    const base = av.localeCompare(bv, locale);
    if (base !== 0) {
      return base * factor;
    }
    return a.hero.localeCompare(b.hero, locale);
  }

  if (av !== bv) {
    return (av - bv) * factor;
  }

  return a.hero.localeCompare(b.hero, locale);
};

const escapeCsvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

function App() {
  const [lang, setLang] = useState('zh');
  const copy = useMemo(() => getCopy(lang), [lang]);

  const [sessionSeed] = useState(() => loadAccountSession());
  const [inputAccountId, setInputAccountId] = useState(sessionSeed.inputAccountId);
  const [savedAccounts, setSavedAccounts] = useState(sessionSeed.savedAccounts);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [queryAccountId, setQueryAccountId] = useState(sessionSeed.queryAccountId);
  const [queryRawId, setQueryRawId] = useState(sessionSeed.queryRawId);
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(sessionSeed.days);
  const [activeTab, setActiveTab] = useState(TAB_IDS.overview);
  const [recentMatchesPage, setRecentMatchesPage] = useState(1);
  const [sortKey, setSortKey] = useState('winRate');
  const [sortDir, setSortDir] = useState('desc');
  const [attributeFilter, setAttributeFilter] = useState('all');
  const [minMatches, setMinMatches] = useState(2);
  const [selectedHeroRowId, setSelectedHeroRowId] = useState(null);
  const [heroRowManuallyCollapsed, setHeroRowManuallyCollapsed] = useState(false);
  const [showSample, setShowSample] = useState(() => !sessionSeed.queryAccountId);
  const [heroMetaById, setHeroMetaById] = useState(() => new Map());
  const [inputError, setInputError] = useState('');
  const [selectedRecentMatchId, setSelectedRecentMatchId] = useState(null);
  const [recentMatchDetail, setRecentMatchDetail] = useState(null);
  const [recentMatchDetailLoading, setRecentMatchDetailLoading] = useState(false);
  const [recentMatchDetailError, setRecentMatchDetailError] = useState(null);
  const [recentMatchDetailReloadKey, setRecentMatchDetailReloadKey] = useState(0);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0);
  const tabRefs = useRef(new Map());
  const analyticsResource = usePlayerAnalytics({
    accountId: queryAccountId,
    days,
    lang,
    reloadKey,
  });
  const sampleDashboard = useMemo(() => createMockDashboard(copy, lang), [copy, lang]);
  const activeAnalyticsQueryKey = createAnalyticsQueryKey(queryAccountId, days);
  const resourceMatchesActiveQuery =
    Boolean(activeAnalyticsQueryKey) && analyticsResource.queryKey === activeAnalyticsQueryKey;
  const hasLiveDashboard =
    resourceMatchesActiveQuery && Boolean(analyticsResource.data);
  const dashboard = hasLiveDashboard ? analyticsResource.data : sampleDashboard;
  const loading =
    Boolean(activeAnalyticsQueryKey) &&
    (!resourceMatchesActiveQuery || analyticsResource.status === 'loading' || analyticsResource.isRefreshing);
  const queryResourceError = resourceMatchesActiveQuery ? analyticsResource.error : null;
  const queryError = queryResourceError?.message || '';
  const teammateAccessIssue = Array.isArray(dashboard.accessIssues)
    ? dashboard.accessIssues.find((issue) => issue?.slice === 'teammates') ?? null
    : null;
  const selectableMatchesById = useMemo(() => {
    const merged = [...(dashboard.recentMatches ?? []), ...(dashboard.windowMatches ?? [])];
    const byMatchId = new Map();
    merged.forEach((match) => {
      if (match?.matchId && !byMatchId.has(match.matchId)) {
        byMatchId.set(match.matchId, match);
      }
    });
    return byMatchId;
  }, [dashboard.recentMatches, dashboard.windowMatches]);
  const selectableMatches = useMemo(() => Array.from(selectableMatchesById.values()), [selectableMatchesById]);
  const selectedRecentMatch = useMemo(
    () => selectableMatches.find((item) => item.matchId === selectedRecentMatchId) ?? null,
    [selectableMatches, selectedRecentMatchId]
  );

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  useEffect(() => {
    const retryAfter = Number(queryResourceError?.retryAfter);
    if (!queryError || !Number.isFinite(retryAfter) || retryAfter <= 0) {
      setRetryDelaySeconds(0);
      return undefined;
    }

    setRetryDelaySeconds(Math.ceil(retryAfter));
    const timer = window.setInterval(() => {
      setRetryDelaySeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [queryError, queryResourceError?.retryAfter]);

  useEffect(() => {
    saveAccountSession({
      savedAccounts,
      queryRawId,
      queryAccountId,
      days,
    });
  }, [savedAccounts, queryAccountId, queryRawId, days]);

  useEffect(() => {
    if (activeTab !== TAB_IDS.allHeroes) {
      return undefined;
    }

    const controller = new AbortController();
    const client = createOpenDotaClient(lang);

    const loadHeroMeta = async () => {
      try {
        const map = await client.getHeroesMetaMap(controller.signal);
        if (!controller.signal.aborted) {
          setHeroMetaById(map);
        }
      } catch {
        if (!controller.signal.aborted) {
          setHeroMetaById(new Map());
        }
      }
    };

    loadHeroMeta();

    return () => {
      controller.abort();
    };
  }, [activeTab, lang]);

  useEffect(() => {
    const data = analyticsResource.data;
    if (!data || analyticsResource.queryKey !== `${queryAccountId}:${days}`) {
      return;
    }

    setSavedAccounts((previous) =>
      previous.map((account) =>
        account.accountId === queryAccountId
          ? {
              ...account,
              nickname: data.playerName,
              avatar: data.playerAvatar || account.avatar || '',
            }
          : account
      )
    );
  }, [analyticsResource.data, analyticsResource.queryKey, days, queryAccountId]);

  useEffect(() => {
    setSelectedRecentMatchId(null);
    setRecentMatchDetail(null);
    setRecentMatchDetailError(null);
    setRecentMatchDetailLoading(false);
    setSelectedHeroRowId(null);
    setHeroRowManuallyCollapsed(false);
    setRecentMatchesPage(1);
  }, [queryAccountId, days, reloadKey]);

  useEffect(() => {
    if (!selectedRecentMatchId) {
      return;
    }

    const exists = selectableMatches.some((item) => item.matchId === selectedRecentMatchId);
    if (!exists) {
      setSelectedRecentMatchId(null);
      setRecentMatchDetail(null);
      setRecentMatchDetailError(null);
      setRecentMatchDetailLoading(false);
    }
  }, [selectableMatches, selectedRecentMatchId]);

  useEffect(() => {
    if (!selectedRecentMatch) {
      return undefined;
    }

    const controller = new AbortController();
    setRecentMatchDetail(null);
    setRecentMatchDetailError(null);
    setRecentMatchDetailLoading(true);

    const load = async () => {
      if (dashboard.source === 'mock') {
        const mockDetail = createMockRecentMatchDetail(selectedRecentMatch, lang);
        if (!controller.signal.aborted) {
          setRecentMatchDetail(mockDetail);
          setRecentMatchDetailLoading(false);
        }
        return;
      }

      try {
        const detail = await fetchRecentMatchDetail(queryAccountId, selectedRecentMatch.matchId, controller.signal, lang, {
          heroId: selectedRecentMatch.heroId,
          hero: selectedRecentMatch.hero,
          heroAvatar: selectedRecentMatch.heroAvatar,
          playerName: dashboard.playerName,
          playerAvatar: dashboard.playerAvatar,
          playerSlot: selectedRecentMatch.playerSlot,
          startTime: selectedRecentMatch.startTime,
          durationSec: selectedRecentMatch.durationSec,
        });

        if (!controller.signal.aborted) {
          setRecentMatchDetail(detail);
        }
      } catch (loadError) {
        if (!controller.signal.aborted && loadError.name !== 'AbortError') {
          setRecentMatchDetailError({
            code: loadError?.code || 'MATCH_DETAIL_FAILED',
            status: Number.isFinite(loadError?.status) ? loadError.status : null,
            retryable: loadError?.retryable !== false,
            retryAfter: Number.isFinite(loadError?.retryAfter)
              ? loadError.retryAfter
              : null,
            message:
              loadError?.message ||
              copy.recentMatches?.detail?.loadFailed ||
              copy.errors.fetchFailed,
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecentMatchDetailLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [
    selectedRecentMatch,
    dashboard.source,
    dashboard.playerName,
    dashboard.playerAvatar,
    queryAccountId,
    lang,
    copy.recentMatches?.detail?.loadFailed,
    copy.errors.fetchFailed,
    recentMatchDetailReloadKey,
  ]);

  const availableAttributes = useMemo(() => {
    const attributeSet = new Set(dashboard.heroPerformance.map((item) => item.attribute).filter(Boolean));
    return Array.from(attributeSet).sort((a, b) => a.localeCompare(b, lang === 'en' ? 'en' : 'zh'));
  }, [dashboard.heroPerformance, lang]);

  useEffect(() => {
    if (attributeFilter !== 'all' && !availableAttributes.includes(attributeFilter)) {
      setAttributeFilter('all');
    }
  }, [attributeFilter, availableAttributes]);

  const filteredHeroes = useMemo(() => {
    return dashboard.heroPerformance
      .filter((hero) => (attributeFilter === 'all' ? true : hero.attribute === attributeFilter))
      .filter((hero) => hero.matches >= minMatches)
      .slice()
      .sort((a, b) => compareHeroes(a, b, sortKey, sortDir, lang));
  }, [attributeFilter, dashboard.heroPerformance, lang, minMatches, sortDir, sortKey]);

  useEffect(() => {
    if (!selectedHeroRowId) {
      return;
    }
    const hasSelectedHero = filteredHeroes.some((hero) => (hero.heroId ?? hero.hero) === selectedHeroRowId);
    if (!hasSelectedHero) {
      setSelectedHeroRowId(null);
      setHeroRowManuallyCollapsed(false);
    }
  }, [filteredHeroes, selectedHeroRowId]);

  useEffect(() => {
    if (selectedHeroRowId || filteredHeroes.length === 0 || heroRowManuallyCollapsed) {
      return;
    }
    const firstHero = filteredHeroes[0];
    const firstHeroId = firstHero.heroId ?? firstHero.hero;
    if (firstHeroId) {
      setSelectedHeroRowId(firstHeroId);
    }
  }, [filteredHeroes, heroRowManuallyCollapsed, selectedHeroRowId]);

  const paginatedRecentMatches = useMemo(() => dashboard.windowMatches ?? [], [dashboard.windowMatches]);
  const recentMatchesTotalPages = Math.max(1, Math.ceil(paginatedRecentMatches.length / RECENT_MATCHES_PAGE_SIZE));
  const clampedRecentMatchesPage = Math.min(recentMatchesPage, recentMatchesTotalPages);
  const visibleRecentMatches = useMemo(() => {
    const start = (clampedRecentMatchesPage - 1) * RECENT_MATCHES_PAGE_SIZE;
    return paginatedRecentMatches.slice(start, start + RECENT_MATCHES_PAGE_SIZE);
  }, [clampedRecentMatchesPage, paginatedRecentMatches]);
  useEffect(() => {
    if (recentMatchesPage !== clampedRecentMatchesPage) {
      setRecentMatchesPage(clampedRecentMatchesPage);
    }
  }, [recentMatchesPage, clampedRecentMatchesPage]);
  const heroMatchesMap = useMemo(() => {
    const grouped = new Map();
    (dashboard.windowMatches ?? []).forEach((match) => {
      const key = match.heroId ?? match.hero;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(match);
      } else {
        grouped.set(key, [match]);
      }
    });
    return grouped;
  }, [dashboard.windowMatches]);
  const recentMatchSummary = useMemo(() => summarizeRecentMatches(paginatedRecentMatches), [paginatedRecentMatches]);
  const coachInsights = useMemo(
    () =>
      buildCoachInsights({
        heroPerformance: dashboard.heroPerformance,
        windowMatches: dashboard.windowMatches,
      }),
    [dashboard.heroPerformance, dashboard.windowMatches]
  );
  const overviewFeaturedHeroes = useMemo(
    () =>
      (dashboard.heroPerformance ?? [])
        .slice()
        .sort((left, right) => {
          const matchDelta = (right.matches ?? 0) - (left.matches ?? 0);
          if (matchDelta !== 0) {
            return matchDelta;
          }
          return (resolveHeroWinRate(right) ?? -1) - (resolveHeroWinRate(left) ?? -1);
        })
        .slice(0, 5),
    [dashboard.heroPerformance]
  );
  const overviewHeroInsight =
    coachInsights.find((insight) => insight.id === 'heroFocus') ?? coachInsights[0] ?? null;
  const overviewRecentMatches = useMemo(
    () => (dashboard.windowMatches ?? []).slice(0, 5),
    [dashboard.windowMatches]
  );
  const overviewExtremeMatches = useMemo(() => dashboard.windowMatches ?? [], [dashboard.windowMatches]);
  const overviewExtremes = useMemo(() => summarizeOverviewExtremes(overviewExtremeMatches), [overviewExtremeMatches]);
  const overviewAchievementTotals = useMemo(() => {
    if (dashboard.achievementTotals) {
      const normalizeCoverage = (coverage) => ({
        availableMatches: Math.max(0, Math.trunc(toFiniteOrNull(coverage?.availableMatches) ?? 0)),
        totalMatches: Math.max(0, Math.trunc(toFiniteOrNull(coverage?.totalMatches) ?? 0)),
        ratio: Math.max(0, Math.min(1, toFiniteOrNull(coverage?.ratio) ?? 0)),
        complete: coverage?.complete === true,
      });
      return {
        rampage: Math.max(0, Math.trunc(toFiniteOrNull(dashboard.achievementTotals.rampage) ?? 0)),
        godlike: Math.max(0, Math.trunc(toFiniteOrNull(dashboard.achievementTotals.godlike) ?? 0)),
        rampageDataAvailable: dashboard.achievementTotals.rampageDataAvailable === true,
        godlikeDataAvailable: dashboard.achievementTotals.godlikeDataAvailable === true,
        rampagePartialDataAvailable: dashboard.achievementTotals.rampagePartialDataAvailable === true,
        godlikePartialDataAvailable: dashboard.achievementTotals.godlikePartialDataAvailable === true,
        rampageCoverage: normalizeCoverage(dashboard.achievementTotals.rampageCoverage),
        godlikeCoverage: normalizeCoverage(dashboard.achievementTotals.godlikeCoverage),
      };
    }

    const fallbackTotals = (dashboard.windowMatches ?? []).reduce(
      (acc, match) => {
        const rampageCount = toFiniteOrNull(match?.rampageCount);
        const godlikeCount = toFiniteOrNull(match?.godlikeCount);
        const rampageDataAvailable = match?.rampageDataAvailable === true || (rampageCount != null && rampageCount > 0);
        const godlikeDataAvailable = match?.godlikeDataAvailable === true || (godlikeCount != null && godlikeCount > 0);
        acc.rampage += rampageCount == null ? (match?.hasRampage ? 1 : 0) : Math.max(0, Math.trunc(rampageCount));
        acc.godlike += godlikeCount == null ? (match?.hasGodlike ? 1 : 0) : Math.max(0, Math.trunc(godlikeCount));
        acc.rampageAvailableMatches += rampageDataAvailable ? 1 : 0;
        acc.godlikeAvailableMatches += godlikeDataAvailable ? 1 : 0;
        return acc;
      },
      { rampage: 0, godlike: 0, rampageAvailableMatches: 0, godlikeAvailableMatches: 0 }
    );
    const totalMatches = dashboard.windowMatches?.length ?? 0;
    const makeCoverage = (availableMatches) => ({
      availableMatches,
      totalMatches,
      ratio: totalMatches > 0 ? availableMatches / totalMatches : 1,
      complete: availableMatches === totalMatches,
    });
    const rampageCoverage = makeCoverage(fallbackTotals.rampageAvailableMatches);
    const godlikeCoverage = makeCoverage(fallbackTotals.godlikeAvailableMatches);
    return {
      rampage: fallbackTotals.rampage,
      godlike: fallbackTotals.godlike,
      rampageDataAvailable: rampageCoverage.complete,
      godlikeDataAvailable: godlikeCoverage.complete,
      rampagePartialDataAvailable: rampageCoverage.availableMatches > 0 && !rampageCoverage.complete,
      godlikePartialDataAvailable: godlikeCoverage.availableMatches > 0 && !godlikeCoverage.complete,
      rampageCoverage,
      godlikeCoverage,
    };
  }, [dashboard.achievementTotals, dashboard.windowMatches]);
  const overviewGameModeDistribution = useMemo(
    () => buildGameModeDistribution(dashboard.windowMatches, copy.overview.modeDistribution.unknownMode),
    [dashboard.windowMatches, copy.overview.modeDistribution.unknownMode]
  );
  const sideWinRates = useMemo(() => summarizeSideWinRates(dashboard.windowMatches ?? []), [dashboard.windowMatches]);
  const switchToAccount = (account, forceRefresh = false) => {
    setInputAccountId(account.rawId);
    setInputError('');
    setShowSample(false);

    if (account.accountId === queryAccountId && account.rawId === queryRawId) {
      if (forceRefresh) {
        setReloadKey((value) => value + 1);
      }
      return;
    }

    setQueryAccountId(account.accountId);
    setQueryRawId(account.rawId);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedId = inputAccountId.trim();

    const parseResult = parseSteam32(normalizedId, copy.errors);
    if (!parseResult.valid) {
      setInputError(parseResult.message);
      return;
    }

    const { accountId } = parseResult;
    const nextAccount = {
      rawId: accountId,
      accountId,
      nickname: accountId,
      avatar: '',
    };

    const hasSaved = savedAccounts.some((item) => isSameAccount(item, nextAccount));
    if (!hasSaved && savedAccounts.length >= MAX_SAVED_ACCOUNTS) {
      setInputError(copy.errors.accountLimit(MAX_SAVED_ACCOUNTS));
      return;
    }

    if (!hasSaved) {
      setSavedAccounts((prev) => [nextAccount, ...prev].slice(0, MAX_SAVED_ACCOUNTS));
    }

    setInputError('');
    switchToAccount(nextAccount, true);
    setIsAccountModalOpen(false);
  };

  const handleSwitchAccount = (account) => {
    switchToAccount(account, false);
    setIsAccountModalOpen(false);
  };

  const handleRemoveSavedAccount = (account) => {
    const next = savedAccounts.filter((item) => !isSameAccount(item, account));
    if (next.length === savedAccounts.length) {
      return;
    }

    setSavedAccounts(next);
    const activeAccount = { rawId: queryRawId, accountId: queryAccountId };
    if (isSameAccount(account, activeAccount)) {
      if (next.length > 0) {
        switchToAccount(next[0], false);
      } else {
        setInputAccountId('');
        setQueryAccountId('');
        setQueryRawId('');
        setInputError('');
        setShowSample(true);
      }
    }
  };

  const handleMinMatchesChange = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setMinMatches(0);
      return;
    }
    setMinMatches(parsed);
  };

  const handleExportHeroes = () => {
    if (!filteredHeroes.length) {
      return;
    }

    const header = copy.table.headers;
    const rows = [
      [
        header.hero,
        header.attribute,
        header.matches,
        header.knownOutcomes,
        header.unknownOutcomes,
        header.winRate,
        header.avgKda,
        header.avgGpm,
        header.avgXpm,
        header.impact,
      ],
      ...filteredHeroes.map((hero) => [
        hero.hero,
        hero.attribute,
        hero.matches,
        Number.isFinite(hero.outcomeMatches)
          ? hero.outcomeMatches
          : hero.matches,
        Number.isFinite(hero.unknownOutcomes)
          ? hero.unknownOutcomes
          : Math.max(
              0,
              hero.matches -
                (Number.isFinite(hero.outcomeMatches)
                  ? hero.outcomeMatches
                  : hero.matches)
            ),
        resolveHeroWinRate(hero) === null
          ? '-'
          : `${resolveHeroWinRate(hero).toFixed(1)}%`,
        Number.isFinite(hero.avgKda) ? hero.avgKda : '-',
        Number.isFinite(hero.avgGpm) ? hero.avgGpm : '-',
        Number.isFinite(hero.avgXpm) ? hero.avgXpm : '-',
        Number.isFinite(hero.impact) ? hero.impact : '-',
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dotalens-${queryAccountId || 'sample'}-${days}d-heroes.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenRecentMatchDetail = (match) => {
    if (!match?.matchId) {
      return;
    }
    setSelectedRecentMatchId(match.matchId);
  };

  const handleSelectHeroRow = (hero) => {
    if (!hero) {
      return;
    }
    const rowId = hero.heroId ?? hero.hero;
    if (selectedHeroRowId === rowId) {
      setSelectedHeroRowId(null);
      setHeroRowManuallyCollapsed(true);
      return;
    }
    setSelectedHeroRowId(rowId);
    setHeroRowManuallyCollapsed(false);
  };

  const handleCloseRecentMatchDetail = () => {
    setSelectedRecentMatchId(null);
    setRecentMatchDetail(null);
    setRecentMatchDetailError(null);
    setRecentMatchDetailLoading(false);
  };

  const handleRetryRecentMatchDetail = () => {
    if (recentMatchDetailError?.retryable === false) {
      return;
    }
    if (selectedRecentMatchId) {
      invalidateOpenDotaCache({ matchId: selectedRecentMatchId });
    }
    setRecentMatchDetailError(null);
    setRecentMatchDetailReloadKey((value) => value + 1);
  };

  useEffect(() => {
    if (activeTab === TAB_IDS.recentMatches || activeTab === TAB_IDS.heroes || activeTab === TAB_IDS.overview) {
      return;
    }
    if (selectedRecentMatchId) {
      setSelectedRecentMatchId(null);
      setRecentMatchDetail(null);
      setRecentMatchDetailError(null);
      setRecentMatchDetailLoading(false);
    }
  }, [activeTab, selectedRecentMatchId]);

  const tabItems = [
    { id: TAB_IDS.overview, label: copy.tabs.overview },
    { id: TAB_IDS.recentMatches, label: copy.tabs.recentMatches },
    { id: TAB_IDS.heroes, label: copy.tabs.heroes },
    { id: TAB_IDS.teammates, label: copy.tabs.teammates },
    { id: TAB_IDS.trend, label: copy.tabs.trend },
    { id: TAB_IDS.allHeroes, label: copy.tabs.allHeroes },
    { id: TAB_IDS.allItems, label: copy.tabs.allItems },
  ];
  const tabItemById = new Map(tabItems.map((item) => [item.id, item]));
  const navigationCopy = copy.navigation ?? {
    ariaLabel: copy.tabs.ariaLabel,
    home: copy.tabs.overview,
    matches: copy.tabs.recentMatches,
    improve: copy.tabs.heroes,
    library: copy.catalog.ariaLabel,
  };
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    label: navigationCopy[group.id],
  }));
  const activeNavGroup = navGroups.find((group) => group.tabs.includes(activeTab)) ?? navGroups[0];
  const activeGroupTabs = activeNavGroup.tabs.map((tabId) => tabItemById.get(tabId)).filter(Boolean);
  const visibleSubTabs = activeGroupTabs.length > 1 ? activeGroupTabs : [];
  const handleTabKeyDown = (event, index, items) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = items[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current.get(nextTab.id)?.focus();
  };
  const handleNavGroupSelect = (group) => {
    const currentTabInGroup = group.tabs.includes(activeTab);
    if (!currentTabInGroup) {
      setActiveTab(group.tabs[0]);
    }
  };
  const panelLabelId = (tabId) => {
    const group = navGroups.find((item) => item.tabs.includes(tabId));
    return group?.tabs.length === 1 ? `nav-${group.id}` : `tab-${tabId}`;
  };

  const isSampleDashboard = !hasLiveDashboard && showSample;
  const dashboardVisible = hasLiveDashboard || isSampleDashboard;
  const statusLine = queryError
    ? queryError
    : loading && !hasLiveDashboard
      ? copy.query.loading
      : isSampleDashboard
        ? copy.status.mock
        : queryAccountId && hasLiveDashboard
          ? dashboard.totalMatches === 0
            ? copy.status.noRecentMatches({
                playerName: dashboard.playerName,
                days,
                latestMatchDate: formatMatchDate(dashboard.latestMatchStartTime, lang),
              })
            : copy.status.steam({
                playerName: dashboard.playerName,
                rawId: queryRawId,
                days,
                totalMatches: dashboard.totalMatches,
              })
          : copy.query.loading;
  const resourceStatusCopy = copy.resourceStatus ?? {};
  const provenanceCopy = copy.provenance ?? {};
  const retryLabel = resourceStatusCopy.retry ?? copy.query.submit;
  const viewSampleLabel = resourceStatusCopy.viewSample ?? copy.misc.samplePlayerName;
  const retryIsDisallowed = queryResourceError?.retryable === false;
  const retryIsWaiting = !retryIsDisallowed && retryDelaySeconds > 0;
  const recoveryLabel = retryIsDisallowed
    ? resourceStatusCopy.changePlayer ?? copy.query.openAccountModal
    : retryIsWaiting && typeof resourceStatusCopy.retryAfter === 'function'
      ? resourceStatusCopy.retryAfter(retryDelaySeconds)
      : retryLabel;
  const handleQueryRecovery = () => {
    if (!queryAccountId || retryIsDisallowed) {
      setIsAccountModalOpen(true);
      return;
    }
    if (retryIsWaiting) {
      return;
    }
    setShowSample(false);
    setReloadKey((value) => value + 1);
  };
  const handlePrimaryPlayerAction = () => {
    if (queryError) {
      handleQueryRecovery();
      return;
    }
    if (isSampleDashboard && queryAccountId) {
      setShowSample(false);
      setReloadKey((value) => value + 1);
      return;
    }
    setIsAccountModalOpen(true);
  };
  const primaryPlayerActionLabel = queryError
    ? recoveryLabel
    : isSampleDashboard && queryAccountId
      ? retryLabel
      : copy.query.submit;
  const liveDataAsOf = dashboard.asOf
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dashboard.asOf))
    : '';
  const liveDataCoverage = dashboard.dataCoverage
    ? {
        includedMatches: dashboard.dataCoverage.includedMatches ?? dashboard.totalMatches ?? 0,
        retrievedMatches: dashboard.dataCoverage.retrievedMatches ?? dashboard.totalMatches ?? 0,
      }
    : null;

  const worstHero = dashboard.metrics.worstHero;
  const mostPlayedHero = dashboard.metrics.mostPlayedHero;
  const signatureHero = dashboard.metrics.signatureHero;
  const antiSignatureHero = dashboard.metrics.antiSignatureHero;
  const emptyValue = copy.recentMatches.emptyValue;
  const avgGpm = Number.isFinite(dashboard.metrics.avgGpm) ? dashboard.metrics.avgGpm : copy.recentMatches.emptyValue;
  const avgXpm = Number.isFinite(dashboard.metrics.avgXpm) ? dashboard.metrics.avgXpm : copy.recentMatches.emptyValue;
  const resolvedWorstHeroWinRate = resolveHeroWinRate(worstHero);
  const worstHeroWinRate =
    resolvedWorstHeroWinRate === null ? null : resolvedWorstHeroWinRate.toFixed(1);
  const formatAchievementValue = (value, complete, partial) =>
    complete ? value : partial ? `≥ ${value}` : emptyValue;
  const formatAchievementSubtext = (coverage, defaultText) => {
    if (coverage?.complete) {
      return defaultText;
    }
    if (typeof copy.cards.achievementCoverageSubtext === 'function') {
      return copy.cards.achievementCoverageSubtext({
        availableMatches: coverage?.availableMatches ?? 0,
        totalMatches: coverage?.totalMatches ?? 0,
      });
    }
    return `${coverage?.availableMatches ?? 0} / ${coverage?.totalMatches ?? 0}`;
  };
  const highestDamageMatch = overviewExtremes.highestDamageMatch;
  const mostKillsMatch = overviewExtremes.mostKillsMatch;
  const mostDeathsMatch = overviewExtremes.mostDeathsMatch;
  const overviewExtremeRows = [
    { id: 'highestDamage', label: copy.cards.highestDamageMatch, match: highestDamageMatch },
    { id: 'mostKills', label: copy.cards.mostKillsMatch, match: mostKillsMatch },
    { id: 'mostDeaths', label: copy.cards.mostDeathsMatch, match: mostDeathsMatch },
  ].filter((item) => item.match);
  const activeAccount = savedAccounts.find((account) => account.accountId === queryAccountId && account.rawId === queryRawId);
  const activeAccountNickname = activeAccount?.nickname || dashboard.playerName || queryRawId || copy.query.unknownNickname;
  const activeAccountAvatar = activeAccount?.avatar || dashboard.playerAvatar || '';
  const activeAccountAvatarFallback = getAvatarInitial(activeAccountNickname);
  const kdaTrendCopy = {
    ...copy.trend,
    title: copy.trend.kdaTitle,
    latestValue: copy.trend.latestKda,
    ariaLabel: copy.trend.kdaAriaLabel,
    axisValue: copy.trend.kdaAxisValue,
  };
  const gpmTrendCopy = {
    ...copy.trend,
    title: copy.trend.gpmTitle,
    latestValue: copy.trend.latestGpm,
    latestDualValue: copy.trend.latestGpmXpm,
    ariaLabel: copy.trend.gpmAriaLabel,
    axisValue: copy.trend.gpmAxisValue,
    primarySeriesLabel: copy.trend.gpmSeriesLabel,
    secondarySeriesLabel: copy.trend.xpmSeriesLabel,
  };
  const hourlyMatchDistribution = useMemo(
    () => buildHourlyMatchDistribution(dashboard.windowMatches ?? []),
    [dashboard.windowMatches]
  );
  const teammateSummary = dashboard.teammateSummary ?? {};
  const mostPlayedTeammate = teammateSummary.mostPlayed ?? null;
  const bestWinRateTeammate = teammateSummary.bestWinRateOver20 ?? null;
  const worstWinRateTeammate = teammateSummary.worstWinRateOver20 ?? null;
  const radiantWinRateText = sideWinRates.radiant.winRate === null ? emptyValue : `${sideWinRates.radiant.winRate}%`;
  const direWinRateText = sideWinRates.dire.winRate === null ? emptyValue : `${sideWinRates.dire.winRate}%`;
  const overallWinRateText =
    dashboard.metrics.overallWinRate == null
      ? emptyValue
      : `${dashboard.metrics.overallWinRate}%`;

  return (
    <div className="app-shell">
      <header className="broadcast-header">
        <div className="broadcast-header__top">
          <div className="brand-lockup" aria-label={copy.app.eyebrow}>
            <img className="brand-mark" src="/favicon.svg" alt="" width="34" height="34" />
            <span className="brand-wordmark">
              DotaLens <span className="brand-accent">Analytics</span>
            </span>
          </div>

          <div className="hero-top-actions">
            <div className="language-switch" role="group" aria-label={copy.app.languageLabel}>
              <button
                type="button"
                className={lang === 'zh' ? 'is-active' : ''}
                onClick={() => setLang('zh')}
                aria-pressed={lang === 'zh'}
              >
                {copy.app.languages.zh}
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'is-active' : ''}
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                {copy.app.languages.en}
              </button>
            </div>
            <button
              type="button"
              className="account-summary-btn"
              onClick={() => setIsAccountModalOpen(true)}
              aria-label={copy.query.openAccountModal}
            >
              <span className="account-summary-main">
                {activeAccountAvatar ? (
                  <img src={activeAccountAvatar} alt={activeAccountNickname} className="account-avatar account-avatar--summary" loading="lazy" />
                ) : (
                  <span className="account-avatar account-avatar--summary is-fallback">{activeAccountAvatarFallback}</span>
                )}
                <span className="account-summary-name">{activeAccountNickname}</span>
              </span>
            </button>
          </div>
        </div>

        {dashboardVisible ? (
          <nav className="broadcast-nav" aria-label={navigationCopy.ariaLabel ?? copy.tabs.ariaLabel}>
            <div className="broadcast-nav__row">
              {navGroups.map((group) => {
                const isActive = group.id === activeNavGroup.id;
                const controlledTabId = isActive && group.tabs.includes(activeTab) ? activeTab : group.tabs[0];
                return (
                  <button
                    key={group.id}
                    id={`nav-${group.id}`}
                    type="button"
                    className={`broadcast-nav__button ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-controls={`panel-${controlledTabId}`}
                    onClick={() => handleNavGroupSelect(group)}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>

            {visibleSubTabs.length > 0 ? (
              <div className="broadcast-subnav" role="tablist" aria-label={navigationCopy.sectionAriaLabel ?? copy.tabs.ariaLabel}>
                {visibleSubTabs.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(node) => {
                      if (node) {
                        tabRefs.current.set(item.id, node);
                      } else {
                        tabRefs.current.delete(item.id);
                      }
                    }}
                    id={`tab-${item.id}`}
                    role="tab"
                    type="button"
                    className={activeTab === item.id ? 'is-active' : ''}
                    aria-selected={activeTab === item.id}
                    aria-controls={`panel-${item.id}`}
                    tabIndex={activeTab === item.id ? 0 : -1}
                    onClick={() => setActiveTab(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index, visibleSubTabs)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </nav>
        ) : null}
      </header>

      <AccountModal
        open={isAccountModalOpen}
        copy={copy.query}
        inputAccountId={inputAccountId}
        onInputChange={(value) => {
          setInputAccountId(value);
          if (inputError) {
            setInputError('');
          }
        }}
        onSubmit={handleSubmit}
        loading={loading}
        inputError={inputError}
        savedAccounts={savedAccounts}
        activeAccountId={queryAccountId}
        activeRawId={queryRawId}
        maxSavedAccounts={MAX_SAVED_ACCOUNTS}
        onSwitchAccount={handleSwitchAccount}
        onRemoveAccount={handleRemoveSavedAccount}
        days={days}
        onDaysChange={setDays}
        onClose={() => setIsAccountModalOpen(false)}
      />

      <main className="dashboard" aria-busy={loading}>
        <section className="dashboard-hero">
          <div className="dashboard-hero__copy">
            <h1>{copy.app.title}</h1>
            <p className="description">{copy.app.description}</p>
          </div>

          {dashboardVisible ? (
            <div className="dashboard-hero__status">
              <div
                className={`dashboard-hero__status-copy ${queryError && !isSampleDashboard ? 'is-error' : ''}`}
                role={queryError && !isSampleDashboard ? 'alert' : 'status'}
                aria-live="polite"
              >
                {isSampleDashboard ? <strong>{resourceStatusCopy.sampleTitle ?? copy.misc.samplePlayerName}</strong> : null}
                <span>{isSampleDashboard ? copy.status.mock : statusLine}</span>
              </div>
              <button
                type="button"
                className="dashboard-hero__cta"
                onClick={handlePrimaryPlayerAction}
                disabled={Boolean(queryError) && retryIsWaiting}
              >
                {primaryPlayerActionLabel}
              </button>
            </div>
          ) : null}
        </section>

        {!dashboardVisible ? (
          <section className={`panel resource-state resource-state--${queryError ? 'error' : 'loading'}`} role={queryError ? 'alert' : 'status'}>
            <h2>{queryError ? resourceStatusCopy.errorTitle ?? copy.errors.fetchFailed : resourceStatusCopy.loadingTitle ?? copy.query.loading}</h2>
            <p>
              {queryError
                ? resourceStatusCopy.errorBody ?? queryError
                : resourceStatusCopy.loadingBody ?? copy.query.loading}
            </p>
            {queryError ? <p className="resource-state__detail">{queryError}</p> : null}
            {queryError ? (
              <div className="resource-state__actions">
                <button
                  type="button"
                  onClick={handleQueryRecovery}
                  disabled={retryIsWaiting}
                >
                  {queryAccountId ? recoveryLabel : copy.query.submit}
                </button>
                <button type="button" className="secondary-button" onClick={() => setShowSample(true)}>
                  {viewSampleLabel}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {dashboardVisible ? (
          <>
            {hasLiveDashboard ? (
              <section className="data-source-banner data-source-banner--live" role="status">
                <strong>{provenanceCopy.liveTitle ?? 'OpenDota'}</strong>
                {liveDataAsOf ? (
                  <span>
                    {typeof provenanceCopy.updatedAt === 'function'
                      ? provenanceCopy.updatedAt(liveDataAsOf)
                      : liveDataAsOf}
                  </span>
                ) : null}
                {liveDataCoverage ? (
                  <span>
                    {typeof provenanceCopy.windowCoverage === 'function'
                      ? provenanceCopy.windowCoverage(liveDataCoverage)
                      : `${liveDataCoverage.includedMatches}/${liveDataCoverage.retrievedMatches}`}
                  </span>
                ) : null}
                <span>
                  {dashboard.dataCoverage?.complete === false
                    ? provenanceCopy.incomplete ?? resourceStatusCopy.partialTitle
                    : provenanceCopy.complete ?? ''}
                </span>
              </section>
            ) : null}

            {queryError && hasLiveDashboard ? (
              <section className="data-source-banner data-source-banner--warning" role="alert">
                <strong>{resourceStatusCopy.staleTitle ?? copy.errors.fetchFailed}</strong>
                <span>{queryError}</span>
                <button
                  type="button"
                  onClick={handleQueryRecovery}
                  disabled={retryIsWaiting}
                >
                  {recoveryLabel}
                </button>
              </section>
            ) : null}

            {Array.isArray(dashboard.accessIssues) && dashboard.accessIssues.length > 0 ? (
              <section className="data-source-banner data-source-banner--warning" role="status">
                <strong>{resourceStatusCopy.partialTitle ?? copy.errors.fetchFailed}</strong>
                <ul>
                  {dashboard.accessIssues.map((issue, index) => (
                    <li key={`${issue?.slice ?? issue?.resource ?? 'slice'}-${issue?.code ?? index}`}>
                      {issue?.message ?? issue?.code ?? copy.errors.fetchFailed}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

        {activeTab === TAB_IDS.overview ? (
          <section
            id={`panel-${TAB_IDS.overview}`}
            role="region"
            aria-labelledby={panelLabelId(TAB_IDS.overview)}
            className="tab-content"
          >
            <section className="overview-scoreboard" aria-label={copy.overview.performanceSnapshotTitle}>
              <div className="overview-scoreboard__toolbar">
                <h2 className="sr-only">{copy.overview.performanceSnapshotTitle}</h2>
                <div className="range-switch overview-range-switch" role="group" aria-label={copy.query.rangeAriaLabel}>
                  <button
                    type="button"
                    className={days === 30 ? 'is-active' : ''}
                    onClick={() => setDays(30)}
                    aria-pressed={days === 30}
                  >
                    {copy.query.day30}
                  </button>
                  <button
                    type="button"
                    className={days === 365 ? 'is-active' : ''}
                    onClick={() => setDays(365)}
                    aria-pressed={days === 365}
                  >
                    {copy.query.day365}
                  </button>
                </div>
              </div>

              <div className="stats-grid overview-scoreboard__grid">
                <StatCard
                  label={copy.cards.totalMatches}
                  value={dashboard.metrics.totalMatches}
                  subtext={copy.cards.totalMatchesSubtext(days)}
                  accent="gold"
                />
                <StatCard
                  label={copy.cards.overallWinRate}
                  value={overallWinRateText}
                  subtext={copy.cards.overallWinRateSubtext}
                  accent="teal"
                />
                <StatCard
                  label={copy.cards.sideWinRate}
                  value={`${radiantWinRateText} / ${direWinRateText}`}
                  subtext={copy.cards.sideWinRateSubtext({
                    radiantMatches: sideWinRates.radiant.matches,
                    direMatches: sideWinRates.dire.matches,
                  })}
                  accent="teal"
                />
                <StatCard
                  label={copy.cards.avgKda}
                  value={dashboard.metrics.avgKda ?? emptyValue}
                  subtext={copy.cards.avgKdaSubtext}
                  accent="red"
                />
                <StatCard
                  label={copy.cards.avgGpm}
                  value={`${avgGpm} / ${avgXpm}`}
                  subtext={copy.cards.avgGpmSubtext}
                  accent="blue"
                />
                <StatCard
                  label={copy.cards.mostPlayedHero}
                  value={mostPlayedHero.hero}
                  subtext={copy.cards.mostPlayedHeroSubtext({
                    matches: mostPlayedHero.matches,
                    outcomeMatches: mostPlayedHero.outcomeMatches,
                    winRate: mostPlayedHero.winRate,
                  })}
                  accent="gold"
                  showAvatar
                  avatar={mostPlayedHero.heroAvatar}
                  avatarAlt={mostPlayedHero.hero}
                />
                <StatCard
                  label={copy.cards.worstHero}
                  value={worstHero.hero}
                  subtext={copy.cards.worstHeroSubtext({
                    matches: worstHero.matches ?? 0,
                    outcomeMatches: worstHero.outcomeMatches,
                    winRate: worstHeroWinRate,
                  })}
                  accent="red"
                  showAvatar
                  avatar={worstHero.heroAvatar}
                  avatarAlt={worstHero.hero}
                />
              </div>
            </section>

            <section className="overview-main-grid">
              <OverviewHeroFocus
                heroes={overviewFeaturedHeroes}
                insight={overviewHeroInsight}
                coachCopy={copy.coach}
                tableCopy={{ ...copy.table, ...copy.overview }}
                onViewAll={() => setActiveTab(TAB_IDS.heroes)}
                viewAllLabel={copy.overview.heroFocusCta}
              />
              <CoachPanel
                insights={coachInsights}
                days={days}
                copy={copy.coach}
                lang={lang}
                matchesById={selectableMatchesById}
                onSelectMatch={handleOpenRecentMatchDetail}
              />
            </section>

            <OverviewRecentMatches
              matches={overviewRecentMatches}
              copy={copy.recentMatches}
              lang={lang}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
              title={copy.overview.recentMatchesTitle}
            />

            <details className="overview-secondary">
              <summary>{copy.overview.moreStatsTitle}</summary>
              <div className="overview-secondary__content">
            <section className="stats-grid overview-secondary-stats">
              <StatCard
                label={copy.cards.totalMatches}
                value={dashboard.metrics.totalMatches}
                subtext={copy.cards.totalMatchesSubtext(days)}
                accent="gold"
              />
              <StatCard
                label={copy.cards.overallWinRate}
                value={overallWinRateText}
                subtext={copy.cards.overallWinRateSubtext}
                accent="teal"
              />
              <StatCard
                label={copy.cards.sideWinRate}
                value={`${radiantWinRateText} / ${direWinRateText}`}
                subtext={copy.cards.sideWinRateSubtext({
                  radiantMatches: sideWinRates.radiant.matches,
                  direMatches: sideWinRates.dire.matches,
                })}
                accent="teal"
              />
              <StatCard
                label={copy.cards.avgKda}
                value={dashboard.metrics.avgKda ?? emptyValue}
                subtext={copy.cards.avgKdaSubtext}
                accent="red"
              />
              <StatCard
                label={copy.cards.avgGpm}
                value={`${avgGpm} / ${avgXpm}`}
                subtext={copy.cards.avgGpmSubtext}
                accent="blue"
              />
              <StatCard
                label={copy.cards.signatureHero}
                value={signatureHero.hero}
                subtext={copy.cards.signatureHeroSubtext({
                  matches: signatureHero.matches,
                  outcomeMatches: signatureHero.outcomeMatches,
                  winRate: signatureHero.winRate,
                })}
                accent="blue"
                showAvatar
                avatar={signatureHero.heroAvatar}
                avatarAlt={signatureHero.hero}
              />
              <StatCard
                label={copy.cards.mostPlayedHero}
                value={mostPlayedHero.hero}
                subtext={copy.cards.mostPlayedHeroSubtext({
                  matches: mostPlayedHero.matches,
                  outcomeMatches: mostPlayedHero.outcomeMatches,
                  winRate: mostPlayedHero.winRate,
                })}
                accent="teal"
                showAvatar
                avatar={mostPlayedHero.heroAvatar}
                avatarAlt={mostPlayedHero.hero}
              />
              <StatCard
                label={copy.cards.worstHero}
                value={worstHero.hero}
                subtext={copy.cards.worstHeroSubtext({
                  matches: worstHero.matches ?? 0,
                  outcomeMatches: worstHero.outcomeMatches,
                  winRate: worstHeroWinRate,
                })}
                accent="red"
                showAvatar
                avatar={worstHero.heroAvatar}
                avatarAlt={worstHero.hero}
              />
              <StatCard
                label={copy.cards.antiSignatureHero}
                value={antiSignatureHero.hero}
                subtext={copy.cards.antiSignatureHeroSubtext({
                  matches: antiSignatureHero.matches,
                  outcomeMatches: antiSignatureHero.outcomeMatches,
                  winRate: antiSignatureHero.winRate,
                })}
                accent="red"
                showAvatar
                avatar={antiSignatureHero.heroAvatar}
                avatarAlt={antiSignatureHero.hero}
              />
              <StatCard
                label={copy.cards.longestWinStreak}
                value={dashboard.metrics.longestWinStreak}
                subtext={copy.cards.longestWinStreakSubtext(days)}
                accent="gold"
              />
              <StatCard
                label={copy.cards.longestLossStreak}
                value={dashboard.metrics.longestLossStreak}
                subtext={copy.cards.longestLossStreakSubtext(days)}
                accent="red"
              />
              <StatCard
                label={copy.cards.rampageCount}
                value={formatAchievementValue(
                  overviewAchievementTotals.rampage,
                  overviewAchievementTotals.rampageDataAvailable,
                  overviewAchievementTotals.rampagePartialDataAvailable
                )}
                subtext={formatAchievementSubtext(
                  overviewAchievementTotals.rampageCoverage,
                  copy.cards.rampageCountSubtext(days)
                )}
                accent="red"
              />
              <StatCard
                label={copy.cards.godlikeCount}
                value={formatAchievementValue(
                  overviewAchievementTotals.godlike,
                  overviewAchievementTotals.godlikeDataAvailable,
                  overviewAchievementTotals.godlikePartialDataAvailable
                )}
                subtext={formatAchievementSubtext(
                  overviewAchievementTotals.godlikeCoverage,
                  copy.cards.godlikeCountSubtext(days)
                )}
                accent="gold"
              />
              <StatCard
                label={copy.cards.mostPlayedTeammate}
                value={mostPlayedTeammate?.playerName ?? copy.recentMatches.emptyValue}
                subtext={
                  mostPlayedTeammate
                    ? copy.cards.mostPlayedTeammateSubtext({ matches: mostPlayedTeammate.matches })
                    : copy.cards.teammateNoData
                }
                accent="teal"
                showAvatar
                avatar={mostPlayedTeammate?.playerAvatar ?? ''}
                avatarAlt={mostPlayedTeammate?.playerName ?? copy.recentMatches.emptyValue}
              />
              <StatCard
                label={copy.cards.bestWinRateTeammate}
                value={bestWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
                subtext={
                  bestWinRateTeammate
                    ? copy.cards.bestWinRateTeammateSubtext({
                        winRate: bestWinRateTeammate.winRate,
                        matches: bestWinRateTeammate.matches,
                      })
                    : copy.cards.teammateNoData
                }
                accent="gold"
                showAvatar
                avatar={bestWinRateTeammate?.playerAvatar ?? ''}
                avatarAlt={bestWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
              />
              <StatCard
                label={copy.cards.worstWinRateTeammate}
                value={worstWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
                subtext={
                  worstWinRateTeammate
                    ? copy.cards.worstWinRateTeammateSubtext({
                        winRate: worstWinRateTeammate.winRate,
                        matches: worstWinRateTeammate.matches,
                      })
                    : copy.cards.teammateNoData
                }
                accent="red"
                showAvatar
                avatar={worstWinRateTeammate?.playerAvatar ?? ''}
                avatarAlt={worstWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
              />
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>{copy.overview.extremeMatchesTitle}</h2>
                <span className="panel-tag">{copy.overview.tag(days)}</span>
              </div>
              {overviewExtremeRows.length > 0 ? (
                <div className="table-wrap recent-table-wrap">
                  <table className="recent-table">
                    <thead>
                      <tr>
                        <th>{copy.overview.extremeMetricHeader}</th>
                        <th>{copy.recentMatches.headers.date}</th>
                        <th>{copy.recentMatches.headers.hero}</th>
                        <th>{copy.recentMatches.headers.result}</th>
                        <th>{copy.recentMatches.headers.kda}</th>
                        <th>{copy.overview.extremeValueHeader}</th>
                        <th>{copy.recentMatches.headers.matchId}</th>
                        <th>
                          <span className="sr-only">{copy.recentMatches.openMatch}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewExtremeRows.map((item) => {
                        const match = item.match;
                        const resultLabel = copy.recentMatches.result?.[match.result] ?? emptyValue;
                        const rowClassName = `recent-row ${selectedRecentMatchId === match.matchId ? 'is-selected' : ''}`;
                        const dateText = formatMatchDateTime(match.startTime, lang, emptyValue);
                        const kdaLine = `${formatEntryValue(match.kills, emptyValue)}/${formatEntryValue(match.deaths, emptyValue)}/${formatEntryValue(
                          match.assists,
                          emptyValue
                        )}`;
                        const openAriaLabel = copy.recentMatches.openMatchAriaLabel({
                          hero: match.hero || emptyValue,
                          result: resultLabel,
                          date: dateText,
                        });

                        return (
                          <tr key={`${item.id}-${match.matchId}`} className={rowClassName}>
                            <td>{item.label}</td>
                            <td>{dateText}</td>
                            <td>
                              <div className="hero-name-cell">
                                {match.heroAvatar ? (
                                  <img src={match.heroAvatar} alt="" className="hero-avatar" loading="lazy" />
                                ) : null}
                                <span>{match.hero || emptyValue}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`result-pill ${
                                  match.result === 'win'
                                    ? 'is-win'
                                    : match.result === 'loss'
                                      ? 'is-loss'
                                      : 'is-unknown'
                                }`}
                              >
                                {resultLabel}
                              </span>
                            </td>
                            <td>{kdaLine}</td>
                            <td>{formatIntegerDisplay(match.value, lang, emptyValue)}</td>
                            <td>{match.matchId ?? emptyValue}</td>
                            <td className="table-action-cell">
                              <button
                                type="button"
                                className="table-row-action"
                                onClick={() => handleOpenRecentMatchDetail(match)}
                                aria-label={openAriaLabel}
                                aria-pressed={selectedRecentMatchId === match.matchId}
                              >
                                {copy.recentMatches.openMatch}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-text">{copy.overview.extremeMatchesEmpty}</p>
              )}
            </section>

            <section className="two-cols">
              <RankDistribution
                items={dashboard.rankDistribution}
                coverage={dashboard.rankDistributionCoverage}
                days={days}
                copy={copy.rank}
              />
              <GameModeDistributionPie items={overviewGameModeDistribution} days={days} copy={copy.overview.modeDistribution} />
            </section>
              </div>
            </details>
          </section>
        ) : null}

        {activeTab === TAB_IDS.trend ? (
          <section
            id={`panel-${TAB_IDS.trend}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.trend)}
            className="tab-content"
            tabIndex={0}
          >
            <WinRateTrend data={dashboard.dailyWinRate} days={days} copy={copy.trend} percentage />
            <section className="two-cols trend-two-cols">
              <WinRateTrend data={dashboard.dailyKdaTrend ?? []} days={days} copy={kdaTrendCopy} />
              <WinRateTrend
                data={dashboard.dailyGpmTrend ?? []}
                secondaryData={dashboard.dailyXpmTrend ?? []}
                days={days}
                copy={gpmTrendCopy}
              />
            </section>
            <HourlyMatchTrend data={hourlyMatchDistribution} days={days} copy={copy.trend} />
          </section>
        ) : null}

        {activeTab === TAB_IDS.heroes ? (
          <section
            id={`panel-${TAB_IDS.heroes}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.heroes)}
            className="tab-content"
            tabIndex={0}
          >
            <HeroPerformanceTable
              heroes={filteredHeroes}
              attributes={availableAttributes}
              controls={{ sortKey, sortDir, attributeFilter, minMatches }}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              onAttributeFilterChange={setAttributeFilter}
              onMinMatchesChange={handleMinMatchesChange}
              onExport={handleExportHeroes}
              heroMatchesMap={heroMatchesMap}
              selectedHeroId={selectedHeroRowId}
              onSelectHero={handleSelectHeroRow}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
              recentCopy={copy.recentMatches}
              lang={lang}
              copy={copy.table}
            />
          </section>
        ) : null}

        {activeTab === TAB_IDS.teammates ? (
          <section
            id={`panel-${TAB_IDS.teammates}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.teammates)}
            className="tab-content"
            tabIndex={0}
          >
            <TeammatesPanel
              teammates={dashboard.teammates ?? []}
              days={days}
              lang={lang}
              copy={copy.teammates}
              scope={dashboard.teammateScope ?? 'public-history'}
              error={teammateAccessIssue?.message ?? ''}
              errorRetryable={teammateAccessIssue?.retryable !== false}
              retryAfter={teammateAccessIssue?.retryAfter ?? null}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          </section>
        ) : null}

        {activeTab === TAB_IDS.recentMatches ? (
          <section
            id={`panel-${TAB_IDS.recentMatches}`}
            role="region"
            aria-labelledby={panelLabelId(TAB_IDS.recentMatches)}
            className="tab-content"
          >
            <RecentMatchesPanel
              matches={visibleRecentMatches}
              summary={recentMatchSummary}
              copy={copy.recentMatches}
              lang={lang}
              page={clampedRecentMatchesPage}
              pageSize={RECENT_MATCHES_PAGE_SIZE}
              totalCount={paginatedRecentMatches.length}
              totalPages={recentMatchesTotalPages}
              onPageChange={setRecentMatchesPage}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
            />
          </section>
        ) : null}

        {activeTab === TAB_IDS.allHeroes ? (
          <section
            id={`panel-${TAB_IDS.allHeroes}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.allHeroes)}
            className="tab-content"
            tabIndex={0}
          >
            <Suspense fallback={<section className="panel resource-state" role="status">{copy.query.loading}</section>}>
              <CatalogTab kind="heroes" lang={lang} copy={copy} heroMetaById={heroMetaById} />
            </Suspense>
          </section>
        ) : null}

        {activeTab === TAB_IDS.allItems ? (
          <section
            id={`panel-${TAB_IDS.allItems}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.allItems)}
            className="tab-content"
            tabIndex={0}
          >
            <Suspense fallback={<section className="panel resource-state" role="status">{copy.query.loading}</section>}>
              <CatalogTab kind="items" lang={lang} copy={copy} />
            </Suspense>
          </section>
        ) : null}
          </>
        ) : null}
      </main>

      <RecentMatchDetailDrawer
        open={Boolean(selectedRecentMatchId)}
        copy={copy.recentMatches}
        lang={lang}
        match={selectedRecentMatch}
        detail={recentMatchDetail}
        loading={recentMatchDetailLoading}
        error={recentMatchDetailError}
        onClose={handleCloseRecentMatchDetail}
        onRetry={handleRetryRecentMatchDetail}
      />
    </div>
  );
}

export default App;

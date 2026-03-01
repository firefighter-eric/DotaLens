import { useEffect, useMemo, useState } from 'react';
import StatCard from './components/StatCard.jsx';
import WinRateTrend from './components/WinRateTrend.jsx';
import HeroPerformanceTable from './components/HeroPerformanceTable.jsx';
import RankDistribution from './components/RankDistribution.jsx';
import RoleDistribution from './components/RoleDistribution.jsx';
import RecentMatchesPanel from './components/RecentMatchesPanel.jsx';
import RecentMatchDetailDrawer from './components/RecentMatchDetailDrawer.jsx';
import { dailyWinRate, heroPerformance, rankDistribution, recentMatches } from './data/mockDotaData.js';
import { buildRoleDistribution, summarizeDashboard, summarizeRecentMatches } from './utils/metrics.js';
import { fetchPlayerWindowAnalytics, fetchRecentMatchDetail } from './services/opendota.js';
import { getCopy } from './i18n/copy.js';

const MAX_UINT32 = 4294967295n;
const DEFAULT_STEAM32_ID = '898754153';
const DEFAULT_SAMPLE_PLAYER_NAME = getCopy('zh').misc.samplePlayerName;
const MAX_SAVED_ACCOUNTS = 5;
const ACCOUNT_STORAGE_KEY = 'dotalens.accounts.v1';
const RECENT_MATCH_OPTIONS = [10, 20, 30];
const DEFAULT_RECENT_MATCH_LIMIT = 10;
const TAB_IDS = {
  overview: 'overview',
  heroes: 'heroes',
  trend: 'trend',
  rankRole: 'rankRole',
  recentMatches: 'recentMatches',
};

const createMockDashboard = (copy) => {
  const metrics = summarizeDashboard(heroPerformance);
  return {
    source: 'mock',
    playerName: copy.misc.samplePlayerName,
    totalMatches: metrics.totalMatches,
    heroPerformance,
    dailyWinRate,
    rankDistribution,
    recentMatches,
    metrics,
  };
};

const parseOpenDotaId = (value, copy) => {
  if (!/^\d+$/.test(value)) {
    return {
      valid: false,
      message: copy.errors.openDotaNumeric,
    };
  }

  return {
    valid: true,
    accountId: value,
  };
};

const parseSteam32 = (value, copy) => {
  if (!/^\d+$/.test(value)) {
    return {
      valid: false,
      message: copy.errors.steamNumeric,
    };
  }

  try {
    const steam32 = BigInt(value);
    if (steam32 <= 0n || steam32 > MAX_UINT32) {
      return {
        valid: false,
        message: copy.errors.steamInvalid,
      };
    }

    return {
      valid: true,
      accountId: steam32.toString(),
    };
  } catch {
    return {
      valid: false,
      message: copy.errors.steamInvalid,
    };
  }
};

const formatMatchDate = (startTime, lang) => {
  if (!startTime) {
    return '';
  }

  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startTime * 1000));
};

const createMockRecentMatchDetail = (match, lang) => {
  const normalizedGpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : 0;
  const normalizedXpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : 0;
  const normalizedKda = Number.isFinite(match.kda) ? match.kda : 0;
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
      kda: normalizedKda,
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
    { id: 'mock-player-2', playerName: isZh ? '队友 A' : 'Teammate A', team: 'radiant', hero: 'Invoker', kda: 3.6, kills: 9, deaths: 5, assists: 12, goldPerMin: 598, xpPerMin: 644, lastHits: 201, denies: 12, netWorth: 24890, heroDamage: 35600, towerDamage: 3900, heroHealing: 120 },
    { id: 'mock-player-3', playerName: isZh ? '队友 B' : 'Teammate B', team: 'radiant', hero: 'Mars', kda: 3.4, kills: 6, deaths: 6, assists: 14, goldPerMin: 488, xpPerMin: 571, lastHits: 132, denies: 6, netWorth: 20130, heroDamage: 21900, towerDamage: 4500, heroHealing: 0 },
    { id: 'mock-player-4', playerName: isZh ? '队友 C' : 'Teammate C', team: 'radiant', hero: 'Rubick', kda: 2.8, kills: 4, deaths: 7, assists: 16, goldPerMin: 372, xpPerMin: 503, lastHits: 62, denies: 2, netWorth: 15620, heroDamage: 14300, towerDamage: 1200, heroHealing: 400 },
    { id: 'mock-player-5', playerName: isZh ? '队友 D' : 'Teammate D', team: 'radiant', hero: 'Oracle', kda: 3.1, kills: 2, deaths: 5, assists: 14, goldPerMin: 341, xpPerMin: 462, lastHits: 38, denies: 1, netWorth: 14210, heroDamage: 9200, towerDamage: 600, heroHealing: 12100 },
    { id: 'mock-player-6', playerName: isZh ? '对手 A' : 'Opponent A', team: 'dire', hero: 'Phantom Assassin', kda: 3.0, kills: 11, deaths: 7, assists: 10, goldPerMin: 617, xpPerMin: 653, lastHits: 223, denies: 13, netWorth: 26010, heroDamage: 33800, towerDamage: 3100, heroHealing: 0 },
    { id: 'mock-player-7', playerName: isZh ? '对手 B' : 'Opponent B', team: 'dire', hero: 'Lina', kda: 2.7, kills: 8, deaths: 8, assists: 14, goldPerMin: 512, xpPerMin: 590, lastHits: 151, denies: 9, netWorth: 21250, heroDamage: 29400, towerDamage: 2100, heroHealing: 0 },
    { id: 'mock-player-8', playerName: isZh ? '对手 C' : 'Opponent C', team: 'dire', hero: 'Underlord', kda: 2.3, kills: 5, deaths: 9, assists: 16, goldPerMin: 444, xpPerMin: 530, lastHits: 121, denies: 5, netWorth: 18900, heroDamage: 17300, towerDamage: 2400, heroHealing: 0 },
    { id: 'mock-player-9', playerName: isZh ? '对手 D' : 'Opponent D', team: 'dire', hero: 'Disruptor', kda: 2.1, kills: 3, deaths: 10, assists: 18, goldPerMin: 335, xpPerMin: 470, lastHits: 36, denies: 1, netWorth: 13980, heroDamage: 12900, towerDamage: 430, heroHealing: 0 },
    { id: 'mock-player-10', playerName: isZh ? '对手 E' : 'Opponent E', team: 'dire', hero: 'Warlock', kda: 2.0, kills: 2, deaths: 9, assists: 16, goldPerMin: 322, xpPerMin: 456, lastHits: 34, denies: 0, netWorth: 13450, heroDamage: 8700, towerDamage: 380, heroHealing: 9800 },
  ];

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
    if (sortKey === 'matches') {
      return hero.matches;
    }
    if (sortKey === 'winRate') {
      return hero.matches ? hero.wins / hero.matches : 0;
    }
    if (sortKey === 'avgKda') {
      return hero.avgKda;
    }
    if (sortKey === 'avgGpm') {
      return Number.isFinite(hero.avgGpm) ? hero.avgGpm : -1;
    }
    if (sortKey === 'avgXpm') {
      return Number.isFinite(hero.avgXpm) ? hero.avgXpm : -1;
    }
    return hero.impact;
  };

  const av = getValue(a);
  const bv = getValue(b);

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

const isSameAccount = (a, b) => a.accountId === b.accountId && a.rawId === b.rawId && a.idType === b.idType;

const createDefaultAccount = () => ({
  idType: 'steam',
  rawId: DEFAULT_STEAM32_ID,
  accountId: DEFAULT_STEAM32_ID,
  nickname: DEFAULT_SAMPLE_PLAYER_NAME,
});

const sanitizePersistedAccount = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const idType = value.idType === 'steam' || value.idType === 'opendota' ? value.idType : null;
  const rawId = typeof value.rawId === 'string' ? value.rawId.trim() : '';
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : '';
  const nickname = typeof value.nickname === 'string' ? value.nickname.trim() : '';

  if (!idType || !rawId || !accountId || !/^\d+$/.test(rawId) || !/^\d+$/.test(accountId)) {
    return null;
  }

  return {
    idType,
    rawId,
    accountId,
    nickname: nickname || rawId,
  };
};

const sanitizePersistedAccounts = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set();
  const accounts = [];
  for (const item of value) {
    const account = sanitizePersistedAccount(item);
    if (!account) {
      continue;
    }

    const key = `${account.idType}:${account.rawId}:${account.accountId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    accounts.push(account);

    if (accounts.length >= MAX_SAVED_ACCOUNTS) {
      break;
    }
  }

  return accounts.length ? accounts : null;
};

const createDefaultSession = () => {
  const defaultAccount = createDefaultAccount();
  return {
    inputAccountId: defaultAccount.rawId,
    inputIdType: defaultAccount.idType,
    savedAccounts: [defaultAccount],
    queryAccountId: defaultAccount.accountId,
    queryRawId: defaultAccount.rawId,
    queryIdType: defaultAccount.idType,
  };
};

const loadSessionFromStorage = () => {
  const fallback = createDefaultSession();
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const savedAccounts = sanitizePersistedAccounts(parsed?.savedAccounts) ?? fallback.savedAccounts;
    const persistedActive = sanitizePersistedAccount(parsed?.activeAccount);
    const activeAccount =
      persistedActive && savedAccounts.some((item) => isSameAccount(item, persistedActive))
        ? persistedActive
        : savedAccounts[0];

    return {
      inputAccountId: activeAccount.rawId,
      inputIdType: activeAccount.idType,
      savedAccounts,
      queryAccountId: activeAccount.accountId,
      queryRawId: activeAccount.rawId,
      queryIdType: activeAccount.idType,
    };
  } catch {
    return fallback;
  }
};

function App() {
  const [lang, setLang] = useState('zh');
  const copy = useMemo(() => getCopy(lang), [lang]);

  const [sessionSeed] = useState(() => loadSessionFromStorage());
  const [inputAccountId, setInputAccountId] = useState(sessionSeed.inputAccountId);
  const [inputIdType, setInputIdType] = useState(sessionSeed.inputIdType);
  const [savedAccounts, setSavedAccounts] = useState(sessionSeed.savedAccounts);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [queryAccountId, setQueryAccountId] = useState(sessionSeed.queryAccountId);
  const [queryRawId, setQueryRawId] = useState(sessionSeed.queryRawId);
  const [queryIdType, setQueryIdType] = useState(sessionSeed.queryIdType);
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(14);
  const [activeTab, setActiveTab] = useState(TAB_IDS.recentMatches);
  const [recentMatchesLimit, setRecentMatchesLimit] = useState(DEFAULT_RECENT_MATCH_LIMIT);
  const [sortKey, setSortKey] = useState('impact');
  const [sortDir, setSortDir] = useState('desc');
  const [roleFilter, setRoleFilter] = useState('all');
  const [minMatches, setMinMatches] = useState(0);
  const [dashboard, setDashboard] = useState(() => createMockDashboard(getCopy('zh')));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecentMatchId, setSelectedRecentMatchId] = useState(null);
  const [recentMatchDetail, setRecentMatchDetail] = useState(null);
  const [recentMatchDetailLoading, setRecentMatchDetailLoading] = useState(false);
  const [recentMatchDetailError, setRecentMatchDetailError] = useState('');
  const selectedRecentMatch = useMemo(
    () => (dashboard.recentMatches ?? []).find((item) => item.matchId === selectedRecentMatchId) ?? null,
    [dashboard.recentMatches, selectedRecentMatchId]
  );

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        ACCOUNT_STORAGE_KEY,
        JSON.stringify({
          savedAccounts,
          activeAccount: {
            idType: queryIdType,
            rawId: queryRawId,
            accountId: queryAccountId,
          },
        })
      );
    } catch {
      // Ignore localStorage write failures (for example, privacy mode restrictions).
    }
  }, [savedAccounts, queryAccountId, queryRawId, queryIdType]);

  useEffect(() => {
    if (dashboard.source === 'mock') {
      setDashboard(createMockDashboard(copy));
    }
  }, [copy, dashboard.source]);

  useEffect(() => {
    if (!queryAccountId) {
      return undefined;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPlayerWindowAnalytics(queryAccountId, days, controller.signal, lang);
        setDashboard({
          ...data,
          source: 'opendota',
        });
        setSavedAccounts((prev) =>
          prev.map((account) =>
            account.accountId === queryAccountId
              ? {
                  ...account,
                  nickname: data.playerName,
                }
              : account
          )
        );
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message || copy.errors.fetchFailed);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [queryAccountId, days, reloadKey, lang, copy.errors.fetchFailed]);

  useEffect(() => {
    setSelectedRecentMatchId(null);
    setRecentMatchDetail(null);
    setRecentMatchDetailError('');
    setRecentMatchDetailLoading(false);
  }, [queryAccountId, days, reloadKey]);

  useEffect(() => {
    if (!selectedRecentMatchId) {
      return;
    }

    const exists = (dashboard.recentMatches ?? []).some((item) => item.matchId === selectedRecentMatchId);
    if (!exists) {
      setSelectedRecentMatchId(null);
      setRecentMatchDetail(null);
      setRecentMatchDetailError('');
      setRecentMatchDetailLoading(false);
    }
  }, [dashboard.recentMatches, selectedRecentMatchId]);

  useEffect(() => {
    if (!selectedRecentMatch) {
      return undefined;
    }

    const controller = new AbortController();
    setRecentMatchDetail(null);
    setRecentMatchDetailError('');
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
          playerSlot: selectedRecentMatch.playerSlot,
          startTime: selectedRecentMatch.startTime,
          durationSec: selectedRecentMatch.durationSec,
        });

        if (!controller.signal.aborted) {
          setRecentMatchDetail(detail);
        }
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setRecentMatchDetailError(loadError.message || copy.recentMatches?.detail?.loadFailed || copy.errors.fetchFailed);
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
    queryAccountId,
    lang,
    copy.recentMatches?.detail?.loadFailed,
    copy.errors.fetchFailed,
  ]);

  const availableRoles = useMemo(() => {
    const roleSet = new Set(dashboard.heroPerformance.map((item) => item.role).filter(Boolean));
    return Array.from(roleSet).sort((a, b) => a.localeCompare(b, lang === 'en' ? 'en' : 'zh'));
  }, [dashboard.heroPerformance, lang]);

  useEffect(() => {
    if (roleFilter !== 'all' && !availableRoles.includes(roleFilter)) {
      setRoleFilter('all');
    }
  }, [availableRoles, roleFilter]);

  const filteredHeroes = useMemo(() => {
    return dashboard.heroPerformance
      .filter((hero) => (roleFilter === 'all' ? true : hero.role === roleFilter))
      .filter((hero) => hero.matches >= minMatches)
      .slice()
      .sort((a, b) => compareHeroes(a, b, sortKey, sortDir, lang));
  }, [dashboard.heroPerformance, lang, minMatches, roleFilter, sortDir, sortKey]);

  const roleDistribution = useMemo(() => buildRoleDistribution(dashboard.heroPerformance), [dashboard.heroPerformance]);

  const trendSummary = useMemo(() => {
    if (!dashboard.dailyWinRate.length) {
      return null;
    }
    const values = dashboard.dailyWinRate.map((point) => point.value);
    return {
      latest: dashboard.dailyWinRate[dashboard.dailyWinRate.length - 1].value,
      peak: Math.max(...values),
      bottom: Math.min(...values),
    };
  }, [dashboard.dailyWinRate]);
  const visibleRecentMatches = useMemo(
    () => (dashboard.recentMatches ?? []).slice(0, recentMatchesLimit),
    [dashboard.recentMatches, recentMatchesLimit]
  );
  const recentMatchSummary = useMemo(() => summarizeRecentMatches(visibleRecentMatches), [visibleRecentMatches]);

  const switchToAccount = (account, forceRefresh = false) => {
    setInputIdType(account.idType);
    setInputAccountId(account.rawId);
    setError('');

    if (
      account.accountId === queryAccountId &&
      account.rawId === queryRawId &&
      account.idType === queryIdType
    ) {
      if (forceRefresh) {
        setReloadKey((value) => value + 1);
      }
      return;
    }

    setQueryAccountId(account.accountId);
    setQueryRawId(account.rawId);
    setQueryIdType(account.idType);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedId = inputAccountId.trim();

    const parseResult =
      inputIdType === 'opendota' ? parseOpenDotaId(normalizedId, copy) : parseSteam32(normalizedId, copy);
    if (!parseResult.valid) {
      setError(parseResult.message);
      return;
    }

    const { accountId } = parseResult;
    const nextAccount = {
      idType: inputIdType,
      rawId: normalizedId,
      accountId,
      nickname: normalizedId,
    };

    const hasSaved = savedAccounts.some((item) => isSameAccount(item, nextAccount));
    if (!hasSaved && savedAccounts.length >= MAX_SAVED_ACCOUNTS) {
      setError(copy.errors.accountLimit(MAX_SAVED_ACCOUNTS));
      return;
    }

    if (!hasSaved) {
      setSavedAccounts((prev) => [nextAccount, ...prev].slice(0, MAX_SAVED_ACCOUNTS));
    }

    setError('');
    switchToAccount(nextAccount, true);
    setIsAccountModalOpen(false);
  };

  const handleSwitchAccount = (account) => {
    switchToAccount(account, false);
    setIsAccountModalOpen(false);
  };

  const handleRemoveSavedAccount = (account) => {
    if (savedAccounts.length <= 1) {
      return;
    }

    const next = savedAccounts.filter((item) => !isSameAccount(item, account));
    if (next.length === savedAccounts.length) {
      return;
    }

    setSavedAccounts(next);
    const activeAccount = { idType: queryIdType, rawId: queryRawId, accountId: queryAccountId };
    if (isSameAccount(account, activeAccount)) {
      switchToAccount(next[0], false);
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
      [header.hero, header.role, header.matches, header.winRate, header.avgKda, header.avgGpm, header.avgXpm, header.impact],
      ...filteredHeroes.map((hero) => [
        hero.hero,
        hero.role,
        hero.matches,
        `${((hero.wins / Math.max(1, hero.matches)) * 100).toFixed(1)}%`,
        hero.avgKda,
        Number.isFinite(hero.avgGpm) ? hero.avgGpm : '-',
        Number.isFinite(hero.avgXpm) ? hero.avgXpm : '-',
        hero.impact,
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

  const handleCloseRecentMatchDetail = () => {
    setSelectedRecentMatchId(null);
    setRecentMatchDetail(null);
    setRecentMatchDetailError('');
    setRecentMatchDetailLoading(false);
  };

  useEffect(() => {
    if (activeTab === TAB_IDS.recentMatches) {
      return;
    }
    if (selectedRecentMatchId) {
      setSelectedRecentMatchId(null);
      setRecentMatchDetail(null);
      setRecentMatchDetailError('');
      setRecentMatchDetailLoading(false);
    }
  }, [activeTab, selectedRecentMatchId]);

  const tabItems = [
    { id: TAB_IDS.recentMatches, label: copy.tabs.recentMatches },
    { id: TAB_IDS.heroes, label: copy.tabs.heroes },
    { id: TAB_IDS.trend, label: copy.tabs.trend },
    { id: TAB_IDS.rankRole, label: copy.tabs.rankRole },
    { id: TAB_IDS.overview, label: copy.tabs.overview },
  ];

  const statusLine = error
    ? error
    : queryAccountId
      ? dashboard.source === 'opendota' && dashboard.totalMatches === 0
        ? copy.status.noRecentMatches({
            playerName: dashboard.playerName,
            days,
            latestMatchDate: formatMatchDate(dashboard.latestMatchStartTime, lang),
          })
        : queryIdType === 'steam'
        ? copy.status.steam({
            playerName: dashboard.playerName,
            rawId: queryRawId,
            days,
            totalMatches: dashboard.totalMatches,
          })
        : copy.status.opendota({
            playerName: dashboard.playerName,
            accountId: queryAccountId,
            days,
            totalMatches: dashboard.totalMatches,
          })
      : copy.status.mock;

  const bestHero = dashboard.metrics.bestHero;
  const worstHero = dashboard.metrics.worstHero;
  const mostPlayedHero = dashboard.metrics.mostPlayedHero;
  const bestHeroAvgGpm = Number.isFinite(bestHero.avgGpm) ? bestHero.avgGpm : copy.recentMatches.emptyValue;
  const worstHeroAvgGpm = Number.isFinite(worstHero.avgGpm) ? worstHero.avgGpm : copy.recentMatches.emptyValue;
  const topRole = roleDistribution[0]?.role;
  const activeAccount = savedAccounts.find(
    (account) => account.accountId === queryAccountId && account.rawId === queryRawId && account.idType === queryIdType
  );
  const activeAccountNickname = activeAccount?.nickname || dashboard.playerName || queryRawId || copy.query.unknownNickname;
  const overviewInsights = [
    copy.overview.insightWinRate({
      overallWinRate: dashboard.metrics.overallWinRate,
      totalMatches: dashboard.metrics.totalMatches,
    }),
    copy.overview.insightBestHero(bestHero.hero),
    topRole ? copy.overview.insightTopRole(topRole) : copy.overview.insightTopRoleFallback,
  ];

  return (
    <div className="app-shell">
      <header className="hero-header">
        <div className="hero-header__content">
          <div className="hero-top">
            <p className="eyebrow">{copy.app.eyebrow}</p>
            <div className="hero-top-actions">
              <div className="language-switch" role="group" aria-label={copy.app.languageLabel}>
                <button
                  type="button"
                  className={lang === 'zh' ? 'is-active' : ''}
                  onClick={() => setLang('zh')}
                  disabled={loading}
                >
                  {copy.app.languages.zh}
                </button>
                <button
                  type="button"
                  className={lang === 'en' ? 'is-active' : ''}
                  onClick={() => setLang('en')}
                  disabled={loading}
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
                <span className="account-summary-name">{activeAccountNickname}</span>
              </button>
            </div>
          </div>

          <h1>{copy.app.title}</h1>
          <p className="description">{copy.app.description}</p>
          <p className={`status-line ${error ? 'is-error' : ''}`}>{statusLine}</p>
        </div>
      </header>

      {isAccountModalOpen ? (
        <div className="account-modal-backdrop" onClick={() => setIsAccountModalOpen(false)} role="presentation">
          <section className="query-panel account-modal" onClick={(event) => event.stopPropagation()}>
            <div className="account-modal-header">
              <p className="account-panel-title">{copy.query.accountModalTitle}</p>
              <button
                type="button"
                className="account-modal-close"
                onClick={() => setIsAccountModalOpen(false)}
                aria-label={copy.query.closeAccountModal}
              >
                ×
              </button>
            </div>
            <form className="query-form" onSubmit={handleSubmit}>
              <label htmlFor="account-id-input">{copy.query.idTypeLabel}</label>
              <div className="id-type-switch" role="group" aria-label={copy.query.idTypeLabel}>
                <button
                  type="button"
                  className={inputIdType === 'steam' ? 'is-active' : ''}
                  onClick={() => setInputIdType('steam')}
                  disabled={loading}
                >
                  {copy.query.idTypes.steam}
                </button>
                <button
                  type="button"
                  className={inputIdType === 'opendota' ? 'is-active' : ''}
                  onClick={() => setInputIdType('opendota')}
                  disabled={loading}
                >
                  {copy.query.idTypes.opendota}
                </button>
              </div>
              <div className="query-controls">
                <input
                  id="account-id-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={copy.query.placeholders[inputIdType]}
                  value={inputAccountId}
                  onChange={(event) => setInputAccountId(event.target.value)}
                />
                <button type="submit" disabled={loading}>
                  {loading ? copy.query.loading : copy.query.submit}
                </button>
              </div>
              <div className="saved-accounts-head">
                <span>{copy.query.savedAccounts(savedAccounts.length, MAX_SAVED_ACCOUNTS)}</span>
                <span>{copy.query.savedAccountsHint}</span>
              </div>
              <div className="saved-accounts" role="list" aria-label={copy.query.savedAccountsAriaLabel}>
                {savedAccounts.map((account) => {
                  const isActive =
                    account.accountId === queryAccountId &&
                    account.rawId === queryRawId &&
                    account.idType === queryIdType;

                  return (
                    <div key={`${account.idType}:${account.rawId}`} className={`saved-account-item ${isActive ? 'is-active' : ''}`}>
                      <button
                        type="button"
                        className="saved-account-btn"
                        onClick={() => handleSwitchAccount(account)}
                        disabled={loading}
                      >
                        <span className="saved-account-name">{account.nickname || account.rawId}</span>
                        <span className="saved-account-meta">
                          {copy.query.idTypes[account.idType]} · {account.rawId}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="saved-account-remove"
                        onClick={() => handleRemoveSavedAccount(account)}
                        disabled={loading || savedAccounts.length <= 1}
                        aria-label={copy.query.removeSavedAccount}
                        title={copy.query.removeSavedAccount}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="range-switch" role="group" aria-label={copy.query.rangeAriaLabel}>
                <button type="button" className={days === 7 ? 'is-active' : ''} onClick={() => setDays(7)} disabled={loading}>
                  {copy.query.day7}
                </button>
                <button
                  type="button"
                  className={days === 14 ? 'is-active' : ''}
                  onClick={() => setDays(14)}
                  disabled={loading}
                >
                  {copy.query.day14}
                </button>
                <button
                  type="button"
                  className={days === 30 ? 'is-active' : ''}
                  onClick={() => setDays(30)}
                  disabled={loading}
                >
                  {copy.query.day30}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <main className="dashboard">
        <section className="tabs-panel">
          <div className="tabs-row" role="tablist" aria-label={copy.tabs.ariaLabel}>
            {tabItems.map((item) => (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                role="tab"
                type="button"
                className={`tab-btn ${activeTab === item.id ? 'is-active' : ''}`}
                aria-selected={activeTab === item.id}
                aria-controls={`panel-${item.id}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === TAB_IDS.overview ? (
          <section
            id={`panel-${TAB_IDS.overview}`}
            role="tabpanel"
            aria-labelledby={`tab-${TAB_IDS.overview}`}
            className="tab-content"
          >
            <section className="panel overview-panel">
              <div className="panel-header">
                <h2>{copy.overview.title}</h2>
                <span className="panel-tag">{copy.overview.tag(days)}</span>
              </div>
              <p className="overview-title">{copy.overview.highlightsTitle}</p>
              <ul className="overview-insights">
                {overviewInsights.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </section>

            <section className="stats-grid">
              <StatCard
                label={copy.cards.totalMatches}
                value={dashboard.metrics.totalMatches}
                subtext={copy.cards.totalMatchesSubtext(days)}
                accent="gold"
              />
              <StatCard
                label={copy.cards.overallWinRate}
                value={`${dashboard.metrics.overallWinRate}%`}
                subtext={copy.cards.overallWinRateSubtext}
                accent="teal"
              />
              <StatCard label={copy.cards.avgKda} value={dashboard.metrics.avgKda} subtext={copy.cards.avgKdaSubtext} accent="red" />
              <StatCard
                label={copy.cards.bestHero}
                value={bestHero.hero}
                subtext={copy.cards.bestHeroSubtext({ impact: bestHero.impact, avgGpm: bestHeroAvgGpm })}
                accent="blue"
              />
              <StatCard
                label={copy.cards.worstHero}
                value={worstHero.hero}
                subtext={copy.cards.worstHeroSubtext({ impact: worstHero.impact, avgGpm: worstHeroAvgGpm })}
                accent="red"
              />
              <StatCard
                label={copy.cards.mostPlayedHero}
                value={mostPlayedHero.hero}
                subtext={copy.cards.mostPlayedHeroSubtext({
                  matches: mostPlayedHero.matches,
                  winRate: mostPlayedHero.winRate,
                })}
                accent="teal"
              />
            </section>

            <section className="two-cols">
              <WinRateTrend data={dashboard.dailyWinRate} days={days} copy={copy.trend} />
              <RankDistribution items={dashboard.rankDistribution} days={days} copy={copy.rank} />
            </section>
          </section>
        ) : null}

        {activeTab === TAB_IDS.heroes ? (
          <section id={`panel-${TAB_IDS.heroes}`} role="tabpanel" aria-labelledby={`tab-${TAB_IDS.heroes}`} className="tab-content">
            <HeroPerformanceTable
              heroes={filteredHeroes}
              roles={availableRoles}
              controls={{ sortKey, sortDir, roleFilter, minMatches }}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              onRoleFilterChange={setRoleFilter}
              onMinMatchesChange={handleMinMatchesChange}
              onExport={handleExportHeroes}
              copy={copy.table}
            />
          </section>
        ) : null}

        {activeTab === TAB_IDS.trend ? (
          <section id={`panel-${TAB_IDS.trend}`} role="tabpanel" aria-labelledby={`tab-${TAB_IDS.trend}`} className="tab-content">
            <section className="two-cols">
              <WinRateTrend data={dashboard.dailyWinRate} days={days} copy={copy.trend} />
              <section className="panel trend-summary-panel">
                <div className="panel-header">
                  <h2>{copy.trend.detailTitle}</h2>
                  <span className="panel-tag">{copy.trend.detailTag}</span>
                </div>
                {trendSummary ? (
                  <ul className="overview-insights">
                    <li>{copy.trend.detailLatest(trendSummary.latest)}</li>
                    <li>{copy.trend.detailPeak(trendSummary.peak)}</li>
                    <li>{copy.trend.detailBottom(trendSummary.bottom)}</li>
                  </ul>
                ) : (
                  <p className="empty-text">{copy.trend.detailEmpty}</p>
                )}
              </section>
            </section>
          </section>
        ) : null}

        {activeTab === TAB_IDS.rankRole ? (
          <section
            id={`panel-${TAB_IDS.rankRole}`}
            role="tabpanel"
            aria-labelledby={`tab-${TAB_IDS.rankRole}`}
            className="tab-content"
          >
            <section className="two-cols">
              <RankDistribution items={dashboard.rankDistribution} days={days} copy={copy.rank} />
              <RoleDistribution items={roleDistribution} days={days} copy={copy.role} />
            </section>
          </section>
        ) : null}

        {activeTab === TAB_IDS.recentMatches ? (
          <section
            id={`panel-${TAB_IDS.recentMatches}`}
            role="tabpanel"
            aria-labelledby={`tab-${TAB_IDS.recentMatches}`}
            className="tab-content"
          >
            <RecentMatchesPanel
              matches={visibleRecentMatches}
              summary={recentMatchSummary}
              copy={copy.recentMatches}
              lang={lang}
              limit={recentMatchesLimit}
              options={RECENT_MATCH_OPTIONS}
              onLimitChange={setRecentMatchesLimit}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
            />
          </section>
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
      />
    </div>
  );
}

export default App;

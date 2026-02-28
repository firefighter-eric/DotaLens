import { summarizeDashboard } from '../utils/metrics.js';
import { createOpenDotaClient } from './opendotaClient.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const localeConfig = {
  zh: {
    laneRoleMap: {
      1: '优势路',
      2: '中路',
      3: '劣势路',
      4: '野区',
    },
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
    roamingRole: '游走',
    unknownRole: '未标注',
    playerFallback: (accountId) => `玩家 ${accountId}`,
  },
  en: {
    laneRoleMap: {
      1: 'Safe Lane',
      2: 'Mid Lane',
      3: 'Off Lane',
      4: 'Jungle',
    },
    rankTierMap: {
      1: 'Herald',
      2: 'Guardian',
      3: 'Crusader',
      4: 'Archon',
      5: 'Legend',
      6: 'Ancient',
      7: 'Divine',
      8: 'Immortal',
    },
    skillMap: {
      1: 'Normal',
      2: 'High',
      3: 'Very High',
    },
    roamingRole: 'Roaming',
    unknownRole: 'Unlabeled',
    playerFallback: (accountId) => `Player ${accountId}`,
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pad2 = (value) => String(value).padStart(2, '0');

const getLocaleConfig = (locale) => localeConfig[locale] ?? localeConfig.zh;

const isMatchWin = (match) => {
  const isRadiant = match.player_slot < 128;
  return (isRadiant && match.radiant_win) || (!isRadiant && !match.radiant_win);
};

const toLabel = (date) => `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;

const getDayStart = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const getMainRole = (roleCount, unknownRole) => {
  const sorted = Object.entries(roleCount).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? unknownRole;
};

const buildDailyWinRate = (matches, days) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStartMs = today.getTime();

  const buckets = Array.from({ length: days }, (_, index) => {
    const offset = days - 1 - index;
    const date = new Date(todayStartMs - offset * DAY_MS);
    return {
      day: toLabel(date),
      matches: 0,
      wins: 0,
    };
  });

  matches.forEach((match) => {
    const matchDayStart = getDayStart(match.start_time * 1000);
    const diff = Math.floor((todayStartMs - matchDayStart) / DAY_MS);
    if (diff < 0 || diff >= days) {
      return;
    }
    const bucketIndex = days - 1 - diff;
    buckets[bucketIndex].matches += 1;
    buckets[bucketIndex].wins += isMatchWin(match) ? 1 : 0;
  });

  let previousValue = 0;
  return buckets.map((bucket) => {
    if (bucket.matches > 0) {
      previousValue = Math.round((bucket.wins / bucket.matches) * 100);
    }
    return {
      day: bucket.day,
      value: previousValue,
    };
  });
};

const buildHeroPerformance = (matches, heroesMap, locale) => {
  const aggregate = new Map();

  matches.forEach((match) => {
    const heroId = match.hero_id;
    const record = aggregate.get(heroId) ?? {
      hero: heroesMap.get(heroId) ?? `Hero #${heroId}`,
      matches: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      gpm: 0,
      roleCount: {},
    };

    record.matches += 1;
    record.wins += isMatchWin(match) ? 1 : 0;
    record.kills += match.kills ?? 0;
    record.deaths += match.deaths ?? 0;
    record.assists += match.assists ?? 0;
    record.gpm += match.gold_per_min ?? 0;

    const role = locale.laneRoleMap[match.lane_role] ?? (match.is_roaming ? locale.roamingRole : locale.unknownRole);
    record.roleCount[role] = (record.roleCount[role] ?? 0) + 1;

    aggregate.set(heroId, record);
  });

  return Array.from(aggregate.values())
    .map((record) => {
      const avgKda = (record.kills + record.assists) / Math.max(1, record.deaths);
      const avgGpm = Math.round(record.gpm / record.matches);
      const winRate = (record.wins / record.matches) * 100;
      const impact = clamp(Math.round(winRate * 0.55 + avgKda * 8 + avgGpm / 24), 0, 99);

      return {
        hero: record.hero,
        role: getMainRole(record.roleCount, locale.unknownRole),
        matches: record.matches,
        wins: record.wins,
        avgKda: Number(avgKda.toFixed(2)),
        avgGpm,
        impact,
      };
    })
    .sort((a, b) => b.matches - a.matches);
};

const buildRankDistribution = (matches, locale) => {
  const tierCounter = new Map();
  const skillCounter = new Map();

  matches.forEach((match) => {
    const rankTier = match.average_rank ?? match.average_rank_tier ?? match.rank_tier;
    if (rankTier) {
      const major = Math.floor(rankTier / 10);
      const label = locale.rankTierMap[major];
      if (label) {
        tierCounter.set(label, (tierCounter.get(label) ?? 0) + 1);
      }
      return;
    }

    const skill = locale.skillMap[match.skill];
    if (skill) {
      skillCounter.set(skill, (skillCounter.get(skill) ?? 0) + 1);
    }
  });

  const source = tierCounter.size > 0 ? tierCounter : skillCounter;
  const total = Array.from(source.values()).reduce((sum, value) => sum + value, 0);

  if (!total) {
    return [];
  }

  return Array.from(source.entries())
    .map(([tier, count]) => ({
      tier,
      ratio: Number(((count / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.ratio - a.ratio);
};

export const fetchPlayerWindowAnalytics = async (accountId, days, signal, lang = 'zh') => {
  const locale = getLocaleConfig(lang);
  const client = createOpenDotaClient(lang);

  const [player, matches, heroesMap] = await Promise.all([
    client.getPlayer(accountId, signal),
    client.getPlayerMatchesByDays(accountId, days, signal),
    client.getHeroesMap(signal),
  ]);

  const validMatches = matches.filter((item) => item.start_time);
  if (validMatches.length === 0) {
    const latestMatches = await client.getPlayerLatestMatches(accountId, 1, signal);
    const latestMatchStartTime = latestMatches[0]?.start_time ?? null;

    return {
      playerName: player?.profile?.personaname ?? locale.playerFallback(accountId),
      heroPerformance: [],
      dailyWinRate: [],
      rankDistribution: [],
      metrics: summarizeDashboard([]),
      totalMatches: 0,
      latestMatchStartTime,
    };
  }

  const heroPerformance = buildHeroPerformance(validMatches, heroesMap, locale);
  const dailyWinRate = buildDailyWinRate(validMatches, days);
  const rankDistribution = buildRankDistribution(validMatches, locale);

  return {
    playerName: player?.profile?.personaname ?? locale.playerFallback(accountId),
    heroPerformance,
    dailyWinRate,
    rankDistribution,
    metrics: summarizeDashboard(heroPerformance),
    totalMatches: validMatches.length,
    latestMatchStartTime: validMatches[0]?.start_time ?? null,
  };
};

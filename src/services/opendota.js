import { summarizeDashboard } from '../utils/metrics.js';
import { toValidUnixDate } from '../utils/date.js';
import { createOpenDotaClient } from './opendotaClient.js';

const RECENT_MATCH_FETCH_LIMIT = 30;
const ITEM_SLOTS = [0, 1, 2, 3, 4, 5];
const SKILL_BUILD_LIMIT = 30;
const TEAMMATE_MIN_MATCHES_FOR_WIN_RATE = 20;
const TEAMMATE_DISPLAY_LIMIT = 120;

const localeConfig = {
  zh: {
    laneRoleMap: {
      1: '优势路',
      2: '中路',
      3: '劣势路',
      4: '野区',
    },
    attributeMap: {
      str: '力量',
      agi: '敏捷',
      int: '智力',
      all: '全才',
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
    gameModeMap: {
      0: '未知模式',
      1: '全英雄选择',
      2: '队长模式',
      3: '随机征召',
      4: '单一征召',
      5: '全随机',
      6: '新手教程',
      7: 'Diretide',
      8: '反转队长模式',
      9: 'Greeviling',
      10: '教程',
      11: '中路 SO',
      12: '冷门英雄模式',
      13: '新手池',
      14: 'Compendium 比赛',
      15: '自定义模式',
      16: '队长征召',
      17: '平衡征召',
      18: '技能征召',
      19: '活动模式',
      20: '全随机死亡竞赛',
      21: '中路 1v1',
      22: '全阵营征召',
      23: '快速模式',
      24: '变异模式',
    },
    lobbyTypeMap: {
      0: '普通匹配',
      5: '练习',
      7: '天梯',
      9: '战队天梯',
      12: '活动',
    },
    roamingRole: '游走',
    unknownRole: '未标注',
    unknownAttribute: '未标注',
    unknownRank: '未知',
    unknownMode: '未知模式',
    unknownQueue: '未知队列',
    unknownPlayer: '匿名玩家',
    playerFallback: (accountId) => `玩家 ${accountId}`,
  },
  en: {
    laneRoleMap: {
      1: 'Safe Lane',
      2: 'Mid Lane',
      3: 'Off Lane',
      4: 'Jungle',
    },
    attributeMap: {
      str: 'Strength',
      agi: 'Agility',
      int: 'Intelligence',
      all: 'Universal',
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
    gameModeMap: {
      0: 'Unknown',
      1: 'All Pick',
      2: "Captain's Mode",
      3: 'Random Draft',
      4: 'Single Draft',
      5: 'All Random',
      6: 'Intro',
      7: 'Diretide',
      8: "Reverse Captain's Mode",
      9: 'Greeviling',
      10: 'Tutorial',
      11: 'Mid Only',
      12: 'Least Played',
      13: 'New Player Pool',
      14: 'Compendium Matchmaking',
      15: 'Custom',
      16: "Captain's Draft",
      17: 'Balanced Draft',
      18: 'Ability Draft',
      19: 'Event',
      20: 'All Random Deathmatch',
      21: '1v1 Mid',
      22: 'All Draft',
      23: 'Turbo',
      24: 'Mutation',
    },
    lobbyTypeMap: {
      0: 'Normal Matchmaking',
      5: 'Practice',
      7: 'Ranked',
      9: 'Battle Cup',
      12: 'Event',
    },
    roamingRole: 'Roaming',
    unknownRole: 'Unlabeled',
    unknownAttribute: 'Unlabeled',
    unknownRank: 'Unknown',
    unknownMode: 'Unknown',
    unknownQueue: 'Unknown Queue',
    unknownPlayer: 'Anonymous',
    playerFallback: (accountId) => `Player ${accountId}`,
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pad2 = (value) => String(value).padStart(2, '0');

const getLocaleConfig = (locale) => localeConfig[locale] ?? localeConfig.zh;
const toArray = (value) => (Array.isArray(value) ? value : []);
const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
const normalizeUnixSeconds = (value) => {
  const seconds = toFiniteOrNull(value);
  return seconds !== null && toValidUnixDate(seconds) ? seconds : null;
};
const toPositiveCount = (value) => {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value.games ?? value.count : value;
  const num = toFiniteOrNull(candidate);
  if (num === null || num <= 0) {
    return 0;
  }
  return Math.trunc(num);
};
const toCounterObjectOrNull = (value) => {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value;
};
const sumCounterAtOrAbove = (counter, minTier) => {
  const source = toCounterObjectOrNull(counter);
  if (!source) {
    return null;
  }

  return Object.entries(source).reduce((sum, [key, rawValue]) => {
    const tier = Number.parseInt(String(key), 10);
    if (!Number.isFinite(tier) || tier < minTier) {
      return sum;
    }
    return sum + toPositiveCount(rawValue);
  }, 0);
};
const resolveRampageCount = (source) => {
  const multiKillsCount = sumCounterAtOrAbove(source?.multi_kills, 5);
  if (multiKillsCount !== null) {
    return multiKillsCount;
  }
  return toPositiveCount(source?.rampages);
};
const resolveGodlikeCount = (source) => {
  const killStreakCount = sumCounterAtOrAbove(source?.kill_streaks, 9);
  if (killStreakCount !== null) {
    return killStreakCount;
  }

  return toPositiveCount(source?.max_kill_streak) >= 9 ? 1 : 0;
};
const isRampageDataAvailable = (source) =>
  sumCounterAtOrAbove(source?.multi_kills, 5) !== null || source?.rampages != null;
const isGodlikeDataAvailable = (source) =>
  sumCounterAtOrAbove(source?.kill_streaks, 9) !== null || source?.max_kill_streak != null;
const createCoverage = (availableMatches, totalMatches) => {
  const safeTotal = Math.max(0, Math.trunc(toFiniteOrNull(totalMatches) ?? 0));
  const safeAvailable = clamp(
    Math.max(0, Math.trunc(toFiniteOrNull(availableMatches) ?? 0)),
    0,
    safeTotal
  );
  return {
    availableMatches: safeAvailable,
    totalMatches: safeTotal,
    ratio: safeTotal === 0 ? 1 : Number((safeAvailable / safeTotal).toFixed(4)),
    complete: safeAvailable === safeTotal,
  };
};
const buildAchievementTotalsFromMatches = (matches) => {
  const safeMatches = toArray(matches);
  const totals = safeMatches.reduce(
    (acc, match) => {
      const rampageCount = resolveRampageCount(match);
      const godlikeCount = resolveGodlikeCount(match);
      const rampageDataAvailable = isRampageDataAvailable(match) || rampageCount > 0;
      const godlikeDataAvailable = isGodlikeDataAvailable(match) || godlikeCount > 0;

      acc.rampage += rampageCount;
      acc.godlike += godlikeCount;
      acc.rampageAvailableMatches += rampageDataAvailable ? 1 : 0;
      acc.godlikeAvailableMatches += godlikeDataAvailable ? 1 : 0;
      return acc;
    },
    {
      rampage: 0,
      godlike: 0,
      rampageAvailableMatches: 0,
      godlikeAvailableMatches: 0,
    }
  );
  return {
    rampage: totals.rampage,
    godlike: totals.godlike,
    rampageCoverage: createCoverage(totals.rampageAvailableMatches, safeMatches.length),
    godlikeCoverage: createCoverage(totals.godlikeAvailableMatches, safeMatches.length),
    source: 'projected_matches',
  };
};
const mergeAchievementTotals = (countsTotals, matchTotals) => {
  const counts = countsTotals ?? null;
  const matches = matchTotals ?? null;
  const rampageSource = counts?.rampageCoverage?.complete ? counts : matches;
  const godlikeSource = counts?.godlikeCoverage?.complete ? counts : matches;
  const rampageCoverage = rampageSource?.rampageCoverage ?? createCoverage(0, 0);
  const godlikeCoverage = godlikeSource?.godlikeCoverage ?? createCoverage(0, 0);

  return {
    rampage: rampageSource?.rampage ?? 0,
    godlike: godlikeSource?.godlike ?? 0,
    rampageDataAvailable: rampageCoverage.complete,
    godlikeDataAvailable: godlikeCoverage.complete,
    rampagePartialDataAvailable: rampageCoverage.availableMatches > 0 && !rampageCoverage.complete,
    godlikePartialDataAvailable: godlikeCoverage.availableMatches > 0 && !godlikeCoverage.complete,
    rampageCoverage,
    godlikeCoverage,
    source: counts?.rampageCoverage?.complete || counts?.godlikeCoverage?.complete ? 'counts' : matches?.source ?? 'none',
  };
};
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeAccountId = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const isAbortError = (error) => error?.name === 'AbortError';
const createAccessIssue = (slice, error, details = {}) => ({
  slice,
  code: error?.code ?? 'OPTIONAL_RESOURCE_UNAVAILABLE',
  status: Number.isFinite(error?.status) ? error.status : null,
  resource: error?.resource ?? slice,
  retryable: error?.retryable !== false,
  retryAfter: Number.isFinite(error?.retryAfter) ? error.retryAfter : null,
  message: error?.message || error?.code || 'OPTIONAL_RESOURCE_UNAVAILABLE',
  ...details,
});
const settleOptional = async (slice, promise, fallback) => {
  try {
    return {
      value: await promise,
      issue: null,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return {
      value: fallback,
      issue: createAccessIssue(slice, error),
    };
  }
};

const resolveMatchOutcome = (playerSlot, radiantWin) => {
  const normalizedSlot = toFiniteOrNull(playerSlot);
  if (normalizedSlot === null || (radiantWin !== true && radiantWin !== false)) {
    return 'unknown';
  }
  const isRadiant = normalizedSlot < 128;
  return (isRadiant && radiantWin) || (!isRadiant && !radiantWin) ? 'win' : 'loss';
};

const toLabel = (date) => `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
const toDateKey = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const createWindowBoundary = (days, now = new Date()) => {
  const safeDays = Math.max(1, Math.trunc(Number(days) || 1));
  const endExclusive = new Date(now);
  endExclusive.setHours(0, 0, 0, 0);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const startInclusive = new Date(endExclusive);
  startInclusive.setDate(startInclusive.getDate() - safeDays);
  return {
    kind: 'local-calendar-days',
    days: safeDays,
    startInclusiveMs: startInclusive.getTime(),
    endExclusiveMs: endExclusive.getTime(),
    startInclusiveSec: Math.floor(startInclusive.getTime() / 1000),
    endExclusiveSec: Math.floor(endExclusive.getTime() / 1000),
    startDate: toDateKey(startInclusive),
    endDate: toDateKey(new Date(endExclusive.getTime() - 1)),
    timezoneOffsetMinutes: startInclusive.getTimezoneOffset(),
  };
};

const isMatchInsideBoundary = (match, boundary) => {
  const startTime = normalizeUnixSeconds(match?.start_time);
  if (startTime === null) {
    return false;
  }
  const startMs = startTime * 1000;
  return startMs >= boundary.startInclusiveMs && startMs < boundary.endExclusiveMs;
};

const getMainRole = (roleCount, unknownRole) => {
  const sorted = Object.entries(roleCount).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? unknownRole;
};

const resolveRole = (match, locale) =>
  locale.laneRoleMap[match.lane_role] ?? (match.is_roaming ? locale.roamingRole : locale.unknownRole);
const resolveHeroAttribute = (heroMeta, locale) => locale.attributeMap[heroMeta?.primaryAttr] ?? locale.unknownAttribute;

const resolveRankTierLabel = (rankTier, locale) => {
  const normalizedTier = toFiniteOrNull(rankTier);
  if (normalizedTier === null || normalizedTier <= 0) {
    return null;
  }
  const major = Math.floor(normalizedTier / 10);
  return locale.rankTierMap[major] ?? locale.unknownRank;
};

const resolveMatchRankContext = (match, locale) => {
  const averageRankTier = toFiniteOrNull(match?.average_rank ?? match?.average_rank_tier);
  const skillTier = toFiniteOrNull(match?.skill);
  return {
    matchAverageRankTier: averageRankTier,
    matchAverageRank: resolveRankTierLabel(averageRankTier, locale),
    skillBracketTier: skillTier,
    skillBracket: skillTier === null ? null : locale.skillMap[skillTier] ?? locale.unknownRank,
  };
};

const resolvePlayerRankContext = (player, locale) => {
  const playerRankTier = toFiniteOrNull(player?.rank_tier);
  const skillTier = toFiniteOrNull(player?.skill);
  return {
    playerRankTier,
    playerRank: resolveRankTierLabel(playerRankTier, locale),
    skillBracketTier: skillTier,
    skillBracket: skillTier === null ? null : locale.skillMap[skillTier] ?? locale.unknownRank,
  };
};

const resolveGameMode = (match, locale) => locale.gameModeMap[match.game_mode] ?? locale.unknownMode;
const resolveQueueType = (match, locale) => locale.lobbyTypeMap[match.lobby_type] ?? locale.unknownQueue;

const prettifyToken = (value) =>
  String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveItemById = (itemId, itemMeta) => {
  const id = Number.parseInt(String(itemId), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  const mapped = itemMeta.itemById?.get(id);
  if (mapped) {
    return {
      id,
      name: mapped.name,
      icon: mapped.icon,
    };
  }
  return {
    id,
    name: `Item #${id}`,
    icon: '',
  };
};

const resolveItemNameById = (itemId, itemMeta) => {
  const item = resolveItemById(itemId, itemMeta);
  return item?.name ?? null;
};

const resolveItemNameByKey = (itemKey, itemMeta) => {
  if (!itemKey) {
    return null;
  }
  return itemMeta.nameByKey.get(itemKey) ?? prettifyToken(itemKey);
};

const resolveAbilityName = (abilityId, abilityMeta) => {
  const id = Number.parseInt(String(abilityId), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      name: null,
      available: false,
    };
  }
  const mapped = abilityMeta?.nameById?.get(id);
  return {
    name: mapped ?? `Ability #${id}`,
    available: Boolean(mapped),
  };
};

const resolveCurrentPlayer = (players, { accountId, playerSlot, heroId } = {}) => {
  const safePlayers = toArray(players).filter((entry) => entry && typeof entry === 'object');
  const normalizedAccountId = normalizeAccountId(accountId);
  if (normalizedAccountId !== null) {
    const accountMatches = safePlayers.filter(
      (entry) => normalizeAccountId(entry?.account_id) === normalizedAccountId
    );
    if (accountMatches.length === 1) {
      return {
        player: accountMatches[0],
        matchedBy: 'accountId',
        ambiguous: false,
      };
    }
    if (accountMatches.length > 1) {
      return {
        player: null,
        matchedBy: null,
        ambiguous: true,
      };
    }
  }

  const normalizedSlot = toFiniteOrNull(playerSlot);
  if (normalizedSlot !== null) {
    const slotMatches = safePlayers.filter(
      (entry) => toFiniteOrNull(entry?.player_slot) === normalizedSlot
    );
    if (slotMatches.length === 1) {
      return {
        player: slotMatches[0],
        matchedBy: 'playerSlot',
        ambiguous: false,
      };
    }
    if (slotMatches.length > 1) {
      return {
        player: null,
        matchedBy: null,
        ambiguous: true,
      };
    }
  }

  const normalizedHeroId = toFiniteOrNull(heroId);
  if (normalizedHeroId !== null) {
    const heroMatches = safePlayers.filter(
      (entry) => toFiniteOrNull(entry?.hero_id) === normalizedHeroId
    );
    if (heroMatches.length === 1) {
      return {
        player: heroMatches[0],
        matchedBy: 'heroId',
        ambiguous: false,
      };
    }
    if (heroMatches.length > 1) {
      return {
        player: null,
        matchedBy: null,
        ambiguous: true,
      };
    }
  }

  return {
    player: null,
    matchedBy: null,
    ambiguous: false,
  };
};

const resolveTeamKills = (players, playerSlot) => {
  const isRadiant = Number(playerSlot) < 128;
  let total = 0;
  for (const player of players) {
    if (!player || player.player_slot == null) {
      continue;
    }
    const sameTeam = (player.player_slot < 128) === isRadiant;
    if (!sameTeam) {
      continue;
    }
    const kills = toFiniteOrNull(player.kills);
    if (kills === null) {
      return null;
    }
    total += kills;
  }
  return total;
};

const buildPurchaseTimeline = (player, itemMeta) =>
  toArray(player.purchase_log)
    .filter((entry) => entry && typeof entry.key === 'string')
    .map((entry, index) => ({
      id: `${entry.key}-${entry.time ?? 0}-${index}`,
      timeSec: Math.max(0, Number(entry.time) || 0),
      item: resolveItemNameByKey(entry.key, itemMeta),
      rawKey: entry.key,
    }))
    .sort((a, b) => a.timeSec - b.timeSec);

const resolvePurchaseTime = (timeline, keys) => {
  const matcher = new Set(keys);
  const matched = timeline.find((item) => matcher.has(item.rawKey));
  return matched ? matched.timeSec : null;
};

const resolveOwnedItemTiming = (timeline, keys, ownedFlag) => {
  const acquiredAt = resolvePurchaseTime(timeline, keys);
  const ownedByFlag = ownedFlag === true || (toFiniteOrNull(ownedFlag) ?? 0) > 0;
  const owned = acquiredAt !== null || ownedByFlag;
  return {
    owned,
    acquiredAt,
    timingAvailable: acquiredAt !== null,
    timingSource: acquiredAt !== null ? 'purchase_log' : owned ? 'unknown' : 'not_owned',
  };
};

const buildSkillBuild = (player, abilityMeta) => {
  const withDetail = toArray(player.ability_upgrades)
    .filter((entry) => entry && entry.ability != null)
    .slice(0, SKILL_BUILD_LIMIT)
    .map((entry, index) => {
      const ability = resolveAbilityName(entry.ability, abilityMeta);
      return {
        id: `ability-${index}-${entry.ability}`,
        level: Number(entry.level) || index + 1,
        abilityId: Number(entry.ability),
        ability: ability.name,
        abilityNameAvailable: ability.available,
        timeSec: Number.isFinite(Number(entry.time)) ? Math.max(0, Number(entry.time)) : null,
      };
    });

  if (withDetail.length > 0) {
    return withDetail;
  }

  return toArray(player.ability_upgrades_arr)
    .slice(0, SKILL_BUILD_LIMIT)
    .map((abilityId, index) => {
      const ability = resolveAbilityName(abilityId, abilityMeta);
      return {
        id: `ability-arr-${index}-${abilityId}`,
        level: index + 1,
        abilityId: Number(abilityId),
        ability: ability.name,
        abilityNameAvailable: ability.available,
        timeSec: null,
      };
    });
};

const resolveImpactScore = (outcome, kda, goldPerMin, killParticipation) => {
  if (
    (outcome !== 'win' && outcome !== 'loss') ||
    !Number.isFinite(kda)
  ) {
    return null;
  }
  const winBoost = outcome === 'win' ? 14 : 0;
  const kdaScore = Math.min(kda * 9, 35);
  const gpmScore = Number.isFinite(goldPerMin) ? Math.min(goldPerMin / 11, 35) : 0;
  const kpScore = Number.isFinite(killParticipation) ? Math.min(killParticipation * 0.35, 16) : 0;
  return clamp(Math.round(winBoost + kdaScore + gpmScore + kpScore), 0, 99);
};

const resolvePlayerDisplayName = (player, locale) => {
  const name = player.personaname || player.name;
  if (name) {
    return name;
  }
  if (player.account_id != null) {
    return `${locale.unknownPlayer} #${player.account_id}`;
  }
  return locale.unknownPlayer;
};

const resolvePlayerAvatar = (player, fallback = '') => {
  if (!player || typeof player !== 'object') {
    return fallback;
  }

  const candidates = [
    player.avatarfull,
    player.avatarmedium,
    player.avatar,
    player.profile?.avatarfull,
    player.profile?.avatarmedium,
    player.profile?.avatar,
  ];
  const hit = candidates.find((value) => typeof value === 'string' && value.trim());
  return hit ? hit.trim() : fallback;
};

const resolvePeerDisplayName = (peer, locale) => {
  if (!peer || typeof peer !== 'object') {
    return locale.unknownPlayer;
  }
  const name = peer.personaname || peer.name;
  if (isNonEmptyString(name)) {
    return name.trim();
  }
  const accountId = normalizeAccountId(peer.account_id);
  if (accountId != null) {
    return `${locale.unknownPlayer} #${accountId}`;
  }
  return locale.unknownPlayer;
};

const resolvePeerAverageStat = (peer, games, avgKeys, sumKeys) => {
  for (const key of avgKeys) {
    const value = toFiniteOrNull(peer?.[key]);
    if (value !== null) {
      return value;
    }
  }

  if (games > 0) {
    for (const key of sumKeys) {
      const sumValue = toFiniteOrNull(peer?.[key]);
      if (sumValue !== null) {
        return sumValue / games;
      }
    }
  }

  return null;
};

const buildTeammates = (peers, locale, limit = TEAMMATE_DISPLAY_LIMIT) =>
  toArray(peers)
    .map((peer) => {
      const matches = toPositiveCount(peer?.with_games);
      if (matches <= 0) {
        return null;
      }

      const wins = clamp(toPositiveCount(peer?.with_win), 0, matches);
      const losses = Math.max(0, matches - wins);
      const againstMatches = toPositiveCount(peer?.against_games);
      const againstWins = clamp(toPositiveCount(peer?.against_win), 0, againstMatches);
      const againstWinRate = againstMatches > 0 ? Number(((againstWins / againstMatches) * 100).toFixed(1)) : null;
      const avgKda = resolvePeerAverageStat(peer, matches, ['with_kda', 'kda'], ['with_kda_sum', 'kda_sum']);
      const avgGpm = resolvePeerAverageStat(peer, matches, ['with_gpm', 'gpm'], ['with_gpm_sum', 'gpm_sum']);
      const avgXpm = resolvePeerAverageStat(peer, matches, ['with_xpm', 'xpm'], ['with_xpm_sum', 'xpm_sum']);

      return {
        scope: 'public-history',
        accountId: normalizeAccountId(peer?.account_id),
        playerName: resolvePeerDisplayName(peer, locale),
        playerAvatar: resolvePlayerAvatar(peer),
        matches,
        wins,
        losses,
        winRate: Number(((wins / matches) * 100).toFixed(1)),
        avgKda: avgKda === null ? null : Number(avgKda.toFixed(2)),
        avgGpm: avgGpm === null ? null : Number(avgGpm.toFixed(1)),
        avgXpm: avgXpm === null ? null : Number(avgXpm.toFixed(1)),
        againstMatches,
        againstWins,
        againstWinRate,
        lastPlayed: toFiniteOrNull(peer?.last_played),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins || (a.accountId ?? Number.MAX_SAFE_INTEGER) - (b.accountId ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit);

const buildTeammateSummary = (teammates) => {
  const normalized = toArray(teammates);

  const mostPlayed =
    normalized
      .slice()
      .sort((a, b) => b.matches - a.matches || b.wins - a.wins || (a.accountId ?? Number.MAX_SAFE_INTEGER) - (b.accountId ?? Number.MAX_SAFE_INTEGER))[0] ??
    null;

  const candidateOver20 = normalized.filter((entry) => entry.matches > TEAMMATE_MIN_MATCHES_FOR_WIN_RATE);
  const bestWinRateOver20 =
    candidateOver20
      .slice()
      .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches || b.wins - a.wins || (a.accountId ?? Number.MAX_SAFE_INTEGER) - (b.accountId ?? Number.MAX_SAFE_INTEGER))[0] ??
    null;
  const worstWinRateOver20 =
    candidateOver20
      .slice()
      .sort((a, b) => a.winRate - b.winRate || b.matches - a.matches || a.wins - b.wins || (a.accountId ?? Number.MAX_SAFE_INTEGER) - (b.accountId ?? Number.MAX_SAFE_INTEGER))[0] ??
    null;

  return {
    scope: 'public-history',
    mostPlayed,
    bestWinRateOver20,
    worstWinRateOver20,
  };
};

const summarizeEmbeddedPlayerProfiles = (players) => {
  const eligiblePlayers = toArray(players).filter(
    (entry) => normalizeAccountId(entry?.account_id) != null
  );
  const availableProfiles = eligiblePlayers.filter(
    (entry) =>
      [entry?.personaname, entry?.name].some(isNonEmptyString) ||
      Boolean(resolvePlayerAvatar(entry))
  );
  const unavailable = Math.max(0, eligiblePlayers.length - availableProfiles.length);

  return {
    eligible: eligiblePlayers.length,
    requested: 0,
    loaded: availableProfiles.length,
    applied: 0,
    failed: 0,
    unavailable,
    omitted: unavailable,
    complete: unavailable === 0,
    source: 'match',
  };
};

const buildAllPlayers = (players, heroesMetaMap, itemMeta, locale, currentPlayer, fallback = {}) => {
  const teamSummary = players.reduce(
    (acc, player) => {
      if (!player || player.player_slot == null) {
        return acc;
      }
      const team = player.player_slot < 128 ? 'radiant' : 'dire';
      const kills = toFiniteOrNull(player.kills);
      if (kills === null) {
        acc[team].killsComplete = false;
      } else {
        acc[team].kills += kills;
      }
      acc[team].heroDamage += toFiniteOrNull(player.hero_damage) ?? 0;
      acc[team].netWorth += toFiniteOrNull(player.net_worth ?? player.total_gold) ?? 0;
      return acc;
    },
    {
      radiant: { kills: 0, killsComplete: true, heroDamage: 0, netWorth: 0 },
      dire: { kills: 0, killsComplete: true, heroDamage: 0, netWorth: 0 },
    }
  );

  return players
    .filter((entry) => entry && entry.hero_id != null && entry.player_slot != null)
    .map((entry) => {
      const heroMeta = heroesMetaMap.get(entry.hero_id);
      const kills = toFiniteOrNull(entry.kills);
      const deaths = toFiniteOrNull(entry.deaths);
      const assists = toFiniteOrNull(entry.assists);
      const hasKda = kills !== null && deaths !== null && assists !== null;
      const team = entry.player_slot < 128 ? 'radiant' : 'dire';
      const currentTeam = teamSummary[team];
      const heroDamage = toFiniteOrNull(entry.hero_damage);
      const isCurrentPlayer = entry === currentPlayer;
      const rankContext = resolvePlayerRankContext(entry, locale);
      const itemIds = [...ITEM_SLOTS.map((slot) => entry[`item_${slot}`]), entry.item_neutral];
      const items = itemIds
        .map((id, index) => {
          const item = resolveItemById(id, itemMeta);
          if (!item) {
            return null;
          }
          return {
            ...item,
            isNeutral: index === ITEM_SLOTS.length,
          };
        })
        .filter(Boolean);

      return {
        id: `${entry.account_id ?? 'anonymous'}-${entry.player_slot}-${entry.hero_id}`,
        accountId: entry.account_id ?? null,
        playerSlot: entry.player_slot,
        playerName:
          isCurrentPlayer && isNonEmptyString(fallback.playerName)
            ? fallback.playerName.trim()
            : resolvePlayerDisplayName(entry, locale),
        playerAvatar: resolvePlayerAvatar(entry, isCurrentPlayer ? fallback.playerAvatar : ''),
        team,
        heroId: entry.hero_id,
        hero: heroMeta?.name ?? `Hero #${entry.hero_id}`,
        heroAvatar: heroMeta?.avatar ?? '',
        laneRole: resolveRole(entry, locale),
        rank: rankContext.playerRank ?? rankContext.skillBracket ?? locale.unknownRank,
        rankKind: rankContext.playerRank ? 'playerRank' : rankContext.skillBracket ? 'skillBracket' : 'unknown',
        ...rankContext,
        kills,
        deaths,
        assists,
        kda: hasKda
          ? Number(((kills + assists) / Math.max(1, deaths)).toFixed(2))
          : null,
        goldPerMin: toFiniteOrNull(entry.gold_per_min),
        xpPerMin: toFiniteOrNull(entry.xp_per_min),
        lastHits: toFiniteOrNull(entry.last_hits),
        denies: toFiniteOrNull(entry.denies),
        netWorth: toFiniteOrNull(entry.net_worth ?? entry.total_gold),
        heroDamage,
        towerDamage: toFiniteOrNull(entry.tower_damage),
        heroHealing: toFiniteOrNull(entry.hero_healing),
        level: toFiniteOrNull(entry.level),
        killParticipation:
          currentTeam.killsComplete && currentTeam.kills > 0 && kills !== null && assists !== null
            ? Number((((kills + assists) / currentTeam.kills) * 100).toFixed(1))
            : null,
        damageShare:
          currentTeam.heroDamage > 0 && Number.isFinite(heroDamage)
            ? Number(((heroDamage / currentTeam.heroDamage) * 100).toFixed(1))
            : null,
        items,
        isCurrentPlayer,
      };
    })
    .sort((a, b) => {
      if (a.team !== b.team) {
        return a.team === 'radiant' ? -1 : 1;
      }
      return a.playerSlot - b.playerSlot;
    });
};

const resolveTrendSmoothingWindow = (windowDays) => {
  if (windowDays >= 365) {
    return 7;
  }
  if (windowDays >= 60) {
    return 5;
  }
  if (windowDays >= 30) {
    return 3;
  }
  return 1;
};

const mergeNumericStates = (states) =>
  states.reduce((merged, state) => {
    Object.entries(state).forEach(([key, value]) => {
      if (Number.isFinite(value)) {
        merged[key] = (merged[key] ?? 0) + value;
      }
    });
    return merged;
  }, {});

const buildDailyTrendSeries = (matches, boundaryOrDays, options) => {
  const boundary =
    boundaryOrDays && typeof boundaryOrDays === 'object' && Number.isFinite(boundaryOrDays.startInclusiveMs)
      ? boundaryOrDays
      : createWindowBoundary(boundaryOrDays);
  const buckets = Array.from({ length: boundary.days }, (_, index) => {
    const date = new Date(boundary.startInclusiveMs);
    date.setDate(date.getDate() + index);
    return {
      day: toLabel(date),
      date: toDateKey(date),
      state: options.createState(),
    };
  });
  const bucketByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  toArray(matches).forEach((match) => {
    if (!isMatchInsideBoundary(match, boundary)) {
      return;
    }
    const dateKey = toDateKey(new Date(Number(match.start_time) * 1000));
    const bucket = bucketByDate.get(dateKey);
    if (bucket) {
      options.applyMatch(bucket.state, match);
    }
  });

  const windowSize = resolveTrendSmoothingWindow(boundary.days);
  return buckets.map((bucket, index) => {
    const sampleCount = options.getSampleCount(bucket.state);
    const start = Math.max(0, index - windowSize + 1);
    const segmentStates = buckets.slice(start, index + 1).map((item) => item.state);
    const mergedState = mergeNumericStates(segmentStates);
    const windowSampleCount = options.getSampleCount(mergedState);
    const rawValue = sampleCount > 0 ? options.resolveValue(bucket.state) : null;

    return {
      day: bucket.day,
      date: bucket.date,
      value: sampleCount > 0 && windowSampleCount > 0 ? options.resolveValue(mergedState) : null,
      rawValue,
      sampleCount,
      windowSampleCount,
      observedMatches: bucket.state.observedMatches ?? sampleCount,
      unknownOutcomeCount: bucket.state.unknownOutcomes ?? 0,
      rollingWindow: windowSize,
      isGap: sampleCount === 0,
    };
  });
};

const buildDailyWinRate = (matches, boundaryOrDays) =>
  buildDailyTrendSeries(matches, boundaryOrDays, {
    createState: () => ({ observedMatches: 0, sampleCount: 0, wins: 0, losses: 0, unknownOutcomes: 0 }),
    applyMatch: (state, match) => {
      state.observedMatches += 1;
      const outcome = resolveMatchOutcome(match.player_slot, match.radiant_win);
      if (outcome === 'unknown') {
        state.unknownOutcomes += 1;
        return;
      }
      state.sampleCount += 1;
      state.wins += outcome === 'win' ? 1 : 0;
      state.losses += outcome === 'loss' ? 1 : 0;
    },
    getSampleCount: (state) => state.sampleCount ?? 0,
    resolveValue: (state) => Math.round((state.wins / state.sampleCount) * 100),
  });

const buildDailyKdaTrend = (matches, boundaryOrDays) =>
  buildDailyTrendSeries(matches, boundaryOrDays, {
    createState: () => ({ kills: 0, deaths: 0, assists: 0, sampleCount: 0, observedMatches: 0 }),
    applyMatch: (state, match) => {
      state.observedMatches += 1;
      const kills = toFiniteOrNull(match.kills);
      const deaths = toFiniteOrNull(match.deaths);
      const assists = toFiniteOrNull(match.assists);
      if (kills === null || deaths === null || assists === null) {
        return;
      }
      state.sampleCount += 1;
      state.kills += kills;
      state.deaths += deaths;
      state.assists += assists;
    },
    getSampleCount: (state) => state.sampleCount ?? 0,
    resolveValue: (state) => Number(((state.kills + state.assists) / Math.max(1, state.deaths)).toFixed(2)),
  });

const buildDailyGpmTrend = (matches, boundaryOrDays) =>
  buildDailyTrendSeries(matches, boundaryOrDays, {
    createState: () => ({ gpmTotal: 0, sampleCount: 0, observedMatches: 0 }),
    applyMatch: (state, match) => {
      state.observedMatches += 1;
      const gpm = toFiniteOrNull(match.gold_per_min);
      if (gpm === null) {
        return;
      }
      state.gpmTotal += gpm;
      state.sampleCount += 1;
    },
    getSampleCount: (state) => state.sampleCount ?? 0,
    resolveValue: (state) => Math.round(state.gpmTotal / state.sampleCount),
  });

const buildDailyXpmTrend = (matches, boundaryOrDays) =>
  buildDailyTrendSeries(matches, boundaryOrDays, {
    createState: () => ({ xpmTotal: 0, sampleCount: 0, observedMatches: 0 }),
    applyMatch: (state, match) => {
      state.observedMatches += 1;
      const xpm = toFiniteOrNull(match.xp_per_min);
      if (xpm === null) {
        return;
      }
      state.xpmTotal += xpm;
      state.sampleCount += 1;
    },
    getSampleCount: (state) => state.sampleCount ?? 0,
    resolveValue: (state) => Math.round(state.xpmTotal / state.sampleCount),
  });

const buildHeroPerformance = (matches, heroesMetaMap, locale) => {
  const aggregate = new Map();

  matches.forEach((match) => {
    const heroId = match.hero_id;
    const heroMeta = heroesMetaMap.get(heroId);
    const record = aggregate.get(heroId) ?? {
      heroId,
      hero: heroMeta?.name ?? `Hero #${heroId}`,
      heroAvatar: heroMeta?.avatar ?? '',
      attribute: resolveHeroAttribute(heroMeta, locale),
      matches: 0,
      outcomeMatches: 0,
      wins: 0,
      losses: 0,
      unknownOutcomes: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      kdaMatches: 0,
      gpm: 0,
      gpmMatches: 0,
      xpm: 0,
      xpmMatches: 0,
      roleCount: {},
    };

    record.matches += 1;
    const outcome = resolveMatchOutcome(match.player_slot, match.radiant_win);
    if (outcome === 'unknown') {
      record.unknownOutcomes += 1;
    } else {
      record.outcomeMatches += 1;
      record.wins += outcome === 'win' ? 1 : 0;
      record.losses += outcome === 'loss' ? 1 : 0;
    }
    const kills = toFiniteOrNull(match.kills);
    const deaths = toFiniteOrNull(match.deaths);
    const assists = toFiniteOrNull(match.assists);
    if (kills !== null && deaths !== null && assists !== null) {
      record.kills += kills;
      record.deaths += deaths;
      record.assists += assists;
      record.kdaMatches += 1;
    }
    const gpm = toFiniteOrNull(match.gold_per_min);
    if (gpm !== null) {
      record.gpm += gpm;
      record.gpmMatches += 1;
    }
    const xpm = toFiniteOrNull(match.xp_per_min);
    if (xpm !== null) {
      record.xpm += xpm;
      record.xpmMatches += 1;
    }

    const role = resolveRole(match, locale);
    record.roleCount[role] = (record.roleCount[role] ?? 0) + 1;

    aggregate.set(heroId, record);
  });

  return Array.from(aggregate.values())
    .map((record) => {
      const avgKda =
        record.kdaMatches > 0
          ? (record.kills + record.assists) / Math.max(1, record.deaths)
          : null;
      const avgGpm = record.gpmMatches > 0 ? Math.round(record.gpm / record.gpmMatches) : null;
      const avgXpm = record.xpmMatches > 0 ? Math.round(record.xpm / record.xpmMatches) : null;
      const winRate =
        record.outcomeMatches > 0 ? (record.wins / record.outcomeMatches) * 100 : null;
      const gpmImpact = avgGpm === null ? 0 : avgGpm / 24;
      const impact =
        winRate === null || avgKda === null
          ? null
          : clamp(Math.round(winRate * 0.55 + avgKda * 8 + gpmImpact), 0, 99);

      return {
        heroId: record.heroId,
        hero: record.hero,
        heroAvatar: record.heroAvatar,
        attribute: record.attribute,
        role: getMainRole(record.roleCount, locale.unknownRole),
        matches: record.matches,
        outcomeMatches: record.outcomeMatches,
        wins: record.wins,
        losses: record.losses,
        unknownOutcomes: record.unknownOutcomes,
        winRate: winRate === null ? null : Number(winRate.toFixed(1)),
        kills: record.kills,
        deaths: record.deaths,
        assists: record.assists,
        kdaMatches: record.kdaMatches,
        avgKda: avgKda === null ? null : Number(avgKda.toFixed(2)),
        gpmMatches: record.gpmMatches,
        xpmMatches: record.xpmMatches,
        avgGpm,
        avgXpm,
        impact,
      };
    })
    .sort((a, b) => b.matches - a.matches);
};

const buildMatchRows = (matches, heroesMetaMap, locale) =>
  matches
    .map((match) => ({
      match,
      startTime: normalizeUnixSeconds(match?.start_time),
    }))
    .filter(({ match, startTime }) => startTime !== null && match?.match_id)
    .sort((a, b) => b.startTime - a.startTime)
    .map(({ match, startTime }) => {
      const heroMeta = heroesMetaMap.get(match.hero_id);
      const kills = toFiniteOrNull(match.kills);
      const deaths = toFiniteOrNull(match.deaths);
      const assists = toFiniteOrNull(match.assists);
      const hasKda = kills !== null && deaths !== null && assists !== null;
      const rampageCount = resolveRampageCount(match);
      const godlikeCount = resolveGodlikeCount(match);
      const rampageDataAvailable = isRampageDataAvailable(match);
      const godlikeDataAvailable = isGodlikeDataAvailable(match);
      const result = resolveMatchOutcome(match.player_slot, match.radiant_win);
      const rankContext = resolveMatchRankContext(match, locale);

      return {
        matchId: match.match_id,
        startTime,
        playerSlot: match.player_slot ?? null,
        heroId: match.hero_id,
        hero: heroMeta?.name ?? `Hero #${match.hero_id}`,
        heroAvatar: heroMeta?.avatar ?? '',
        result,
        kills,
        deaths,
        assists,
        kda: hasKda
          ? Number(((kills + assists) / Math.max(1, deaths)).toFixed(2))
          : null,
        goldPerMin: toFiniteOrNull(match.gold_per_min),
        xpPerMin: toFiniteOrNull(match.xp_per_min),
        heroDamage: toFiniteOrNull(match.hero_damage),
        durationSec:
          toFiniteOrNull(match.duration) !== null && Number(match.duration) > 0
            ? Number(match.duration)
            : null,
        gameMode: resolveGameMode(match, locale),
        laneRole: resolveRole(match, locale),
        rank: rankContext.matchAverageRank ?? rankContext.skillBracket ?? locale.unknownRank,
        rankKind: rankContext.matchAverageRank
          ? 'matchAverageRank'
          : rankContext.skillBracket
            ? 'skillBracket'
            : 'unknown',
        ...rankContext,
        rampageCount,
        godlikeCount,
        hasRampage: rampageCount > 0,
        hasGodlike: godlikeCount > 0,
        rampageDataAvailable,
        godlikeDataAvailable,
      };
    });

const buildRecentMatches = (matches, heroesMetaMap, locale, limit = RECENT_MATCH_FETCH_LIMIT) =>
  buildMatchRows(matches, heroesMetaMap, locale).slice(0, limit);

const buildRankDistribution = (matches, locale) => {
  const tierCounter = new Map();
  const skillCounter = new Map();
  const safeMatches = toArray(matches);

  safeMatches.forEach((match) => {
    const rankTier = toFiniteOrNull(match.average_rank ?? match.average_rank_tier);
    if (rankTier !== null && rankTier > 0) {
      const major = Math.floor(rankTier / 10);
      const label = locale.rankTierMap[major];
      if (label) {
        tierCounter.set(label, (tierCounter.get(label) ?? 0) + 1);
      }
    }

    const skill = locale.skillMap[toFiniteOrNull(match.skill)];
    if (skill) {
      skillCounter.set(skill, (skillCounter.get(skill) ?? 0) + 1);
    }
  });

  const toDistribution = (counter) => {
    const total = Array.from(counter.values()).reduce((sum, value) => sum + value, 0);
    if (total === 0) {
      return [];
    }
    return Array.from(counter.entries())
      .map(([tier, count]) => ({
        tier,
        count,
        ratio: Number(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count || a.tier.localeCompare(b.tier));
  };
  const matchAverageRankKnown = Array.from(tierCounter.values()).reduce((sum, value) => sum + value, 0);
  const skillBracketKnown = Array.from(skillCounter.values()).reduce((sum, value) => sum + value, 0);

  return {
    matchAverageRankDistribution: toDistribution(tierCounter),
    matchAverageRankCoverage: createCoverage(matchAverageRankKnown, safeMatches.length),
    skillBracketDistribution: toDistribution(skillCounter),
    skillBracketCoverage: createCoverage(skillBracketKnown, safeMatches.length),
  };
};

const summarizeKnownOutcomeDashboard = (heroPerformance, windowMatches) => {
  const base = summarizeDashboard(heroPerformance, windowMatches);
  const decidedMatches = windowMatches.filter(
    (match) => match.result === 'win' || match.result === 'loss'
  );
  const wins = decidedMatches.reduce(
    (total, match) => total + (match.result === 'win' ? 1 : 0),
    0
  );
  const byMatches = [...heroPerformance].sort(
    (a, b) => b.matches - a.matches || String(a.hero).localeCompare(String(b.hero))
  );
  const toHeroSummary = (hero, fallback) =>
    hero
      ? {
          ...hero,
          winRate: Number.isFinite(hero.winRate) ? hero.winRate.toFixed(1) : null,
        }
      : fallback;
  const eligibleWorst = heroPerformance.filter((hero) => hero.outcomeMatches >= 2);
  const worstHero = [...eligibleWorst].sort(
    (a, b) =>
      a.winRate - b.winRate ||
      b.outcomeMatches - a.outcomeMatches ||
      b.matches - a.matches ||
      String(a.hero).localeCompare(String(b.hero))
  )[0];
  const topTenPercentCount = Math.max(1, Math.ceil(byMatches.length * 0.1));
  const signatureCandidates = byMatches
    .slice(0, topTenPercentCount)
    .filter((hero) => hero.outcomeMatches >= 2);
  const signatureHero = [...signatureCandidates].sort(
    (a, b) =>
      b.winRate - a.winRate ||
      b.outcomeMatches - a.outcomeMatches ||
      String(a.hero).localeCompare(String(b.hero))
  )[0];
  const antiSignatureHero = [...signatureCandidates].sort(
    (a, b) =>
      a.winRate - b.winRate ||
      b.outcomeMatches - a.outcomeMatches ||
      String(a.hero).localeCompare(String(b.hero))
  )[0];
  const mostPlayedHero = byMatches[0];

  return {
    ...base,
    totalMatches: windowMatches.length,
    outcomeMatches: decidedMatches.length,
    unknownOutcomeMatches: windowMatches.length - decidedMatches.length,
    overallWinRate:
      decidedMatches.length > 0 ? ((wins / decidedMatches.length) * 100).toFixed(1) : null,
    worstHero: toHeroSummary(worstHero, {
      hero: '-',
      heroAvatar: '',
      matches: 0,
      outcomeMatches: 0,
      winRate: null,
    }),
    mostPlayedHero: toHeroSummary(mostPlayedHero, base.mostPlayedHero),
    signatureHero: toHeroSummary(signatureHero, {
      hero: '-',
      heroAvatar: '',
      matches: 0,
      outcomeMatches: 0,
      winRate: null,
    }),
    antiSignatureHero: toHeroSummary(antiSignatureHero, {
      hero: '-',
      heroAvatar: '',
      matches: 0,
      outcomeMatches: 0,
      winRate: null,
    }),
  };
};

export const fetchPlayerWindowAnalytics = async (accountId, days, signal, lang = 'zh') => {
  const locale = getLocaleConfig(lang);
  const client = createOpenDotaClient(lang);
  const boundary = createWindowBoundary(days);

  const [player, matchWindow, heroesMetaMap, latestResource, peersResource] = await Promise.all([
    client.getPlayer(accountId, signal),
    client.getPlayerMatchesByDays(accountId, days, signal),
    client.getHeroesMetaMap(signal),
    settleOptional(
      'recentMatches',
      client.getPlayerLatestMatches(accountId, RECENT_MATCH_FETCH_LIMIT, signal),
      []
    ),
    settleOptional('teammates', client.getPlayerPeers(accountId, signal), []),
  ]);
  const rawMatches = toArray(matchWindow?.matches);
  const validMatches = rawMatches.filter((match) => isMatchInsideBoundary(match, boundary));
  const latestMatches = toArray(latestResource.value);
  const teammates = buildTeammates(peersResource.value, locale);
  const teammateSummary = buildTeammateSummary(teammates);
  const achievementTotals = mergeAchievementTotals(null, buildAchievementTotalsFromMatches(validMatches));
  const recentMatches = buildRecentMatches(latestMatches, heroesMetaMap, locale);
  const windowMatches = buildMatchRows(validMatches, heroesMetaMap, locale);
  const heroPerformance = buildHeroPerformance(validMatches, heroesMetaMap, locale);
  const dailyWinRate = buildDailyWinRate(validMatches, boundary);
  const dailyKdaTrend = buildDailyKdaTrend(validMatches, boundary);
  const dailyGpmTrend = buildDailyGpmTrend(validMatches, boundary);
  const dailyXpmTrend = buildDailyXpmTrend(validMatches, boundary);
  const rankData = buildRankDistribution(validMatches, locale);
  const accessIssues = [latestResource.issue, peersResource.issue].filter(Boolean);
  if (matchWindow?.truncated) {
    accessIssues.push(
      createAccessIssue('windowMatches', {
        code: 'PLAYER_MATCHES_TRUNCATED',
        resource: 'playerMatches',
        retryable: false,
        message:
          lang === 'en'
            ? 'The match history reached the retrieval limit, so this window is incomplete.'
            : '比赛历史已达到拉取上限，当前时间窗口的数据不完整。',
      })
    );
  }
  const latestMatchStartTime = [...rawMatches, ...latestMatches].reduce((latest, match) => {
    const startTime = normalizeUnixSeconds(match?.start_time);
    return startTime !== null && startTime > latest ? startTime : latest;
  }, 0);
  const latestWindowMatchStartTime = validMatches.reduce((latest, match) => {
    const startTime = normalizeUnixSeconds(match?.start_time);
    return startTime !== null && startTime > latest ? startTime : latest;
  }, 0);
  const droppedMissingStartTime = rawMatches.filter((match) => {
    const startTime = normalizeUnixSeconds(match?.start_time);
    return startTime === null;
  }).length;
  const droppedOutsideBoundary = Math.max(
    0,
    rawMatches.length - validMatches.length - droppedMissingStartTime
  );
  const metrics = summarizeKnownOutcomeDashboard(heroPerformance, windowMatches);
  const dataCoverage = {
    requestedDays: boundary.days,
    retrievedMatches: rawMatches.length,
    includedMatches: validMatches.length,
    droppedMissingStartTime,
    droppedOutsideBoundary,
    pageCount: matchWindow?.pageCount ?? 0,
    pageLimit: matchWindow?.pageLimit ?? null,
    maxPages: matchWindow?.maxPages ?? null,
    truncated: matchWindow?.truncated === true,
    projectionFallback: matchWindow?.projectionFallback === true,
    windowComplete: matchWindow?.truncated !== true,
    complete: accessIssues.length === 0,
    optionalSlices: {
      recentMatches: latestResource.issue ? 'unavailable' : 'available',
      teammates: peersResource.issue ? 'unavailable' : 'available',
    },
  };

  return {
    playerName: player?.profile?.personaname ?? locale.playerFallback(accountId),
    playerAvatar: resolvePlayerAvatar(player),
    heroPerformance,
    dailyWinRate,
    dailyKdaTrend,
    dailyGpmTrend,
    dailyXpmTrend,
    rankDistribution: rankData.matchAverageRankDistribution,
    rankDistributionCoverage: rankData.matchAverageRankCoverage,
    skillBracketDistribution: rankData.skillBracketDistribution,
    skillBracketCoverage: rankData.skillBracketCoverage,
    recentMatches,
    windowMatches,
    metrics,
    achievementTotals,
    teammates,
    teammateScope: 'public-history',
    teammateSummary,
    totalMatches: validMatches.length,
    outcomeMatches: metrics.outcomeMatches,
    unknownOutcomeMatches: metrics.unknownOutcomeMatches,
    latestMatchStartTime: latestMatchStartTime || null,
    latestWindowMatchStartTime: latestWindowMatchStartTime || null,
    windowBoundary: boundary,
    truncated: matchWindow?.truncated === true,
    dataCoverage,
    accessIssues,
    partial: accessIssues.length > 0,
    status: accessIssues.length > 0 ? 'partial' : 'complete',
  };
};

export const fetchRecentMatchDetail = async (
  accountId,
  matchId,
  signal,
  lang = 'zh',
  fallback = {}
) => {
  const locale = getLocaleConfig(lang);
  const client = createOpenDotaClient(lang);
  const emptyItemMeta = {
    nameById: new Map(),
    nameByKey: new Map(),
    itemById: new Map(),
    itemByKey: new Map(),
  };
  const emptyAbilityMeta = {
    nameById: new Map(),
    available: false,
    source: 'fallback',
    issue: {
      code: 'ABILITY_NAMES_UNAVAILABLE',
      resource: 'abilities',
      retryable: false,
    },
  };

  const [match, heroesMetaMap, itemResource, abilityResource] = await Promise.all([
    client.getMatchById(matchId, signal),
    client.getHeroesMetaMap(signal),
    settleOptional('itemMetadata', client.getItemMeta(signal), emptyItemMeta),
    settleOptional('abilityNames', client.getAbilityNameById(signal), emptyAbilityMeta),
  ]);
  const itemMeta = itemResource.value;
  const abilityMeta = abilityResource.value;

  const rawPlayers = toArray(match.players);
  const players = rawPlayers;
  const playerProfileCoverage = summarizeEmbeddedPlayerProfiles(players);
  const playerIdentity = resolveCurrentPlayer(players, {
    accountId,
    playerSlot: fallback.playerSlot,
    heroId: fallback.heroId,
  });
  const player = playerIdentity.player;

  if (!player) {
    const error = new Error(
      lang === 'en'
        ? 'The requested player could not be identified in this match.'
        : '无法在该场比赛中可靠识别当前玩家。'
    );
    error.code = playerIdentity.ambiguous ? 'MATCH_PLAYER_AMBIGUOUS' : 'MATCH_PLAYER_NOT_FOUND';
    error.resource = 'matchPlayer';
    error.retryable = false;
    throw error;
  }

  const outcome = resolveMatchOutcome(player.player_slot, match.radiant_win);
  const kills = toFiniteOrNull(player.kills);
  const deaths = toFiniteOrNull(player.deaths);
  const assists = toFiniteOrNull(player.assists);
  const hasKda = kills !== null && deaths !== null && assists !== null;
  const kda = hasKda
    ? Number(((kills + assists) / Math.max(1, deaths)).toFixed(2))
    : null;
  const goldPerMin = toFiniteOrNull(player.gold_per_min);
  const xpPerMin = toFiniteOrNull(player.xp_per_min);
  const teamKills = resolveTeamKills(players, player.player_slot);
  const killParticipation =
    Number.isFinite(teamKills) &&
    teamKills > 0 &&
    kills !== null &&
    assists !== null
      ? Number((((kills + assists) / teamKills) * 100).toFixed(1))
      : null;
  const timeline = buildPurchaseTimeline(player, itemMeta);
  const rampageCount = resolveRampageCount(player);
  const godlikeCount = resolveGodlikeCount(player);
  const rampageDataAvailable = isRampageDataAvailable(player);
  const godlikeDataAvailable = isGodlikeDataAvailable(player);
  const heroMeta = heroesMetaMap.get(player.hero_id);
  const impactScore = resolveImpactScore(outcome, kda, goldPerMin, killParticipation);
  const playerRankContext = resolvePlayerRankContext(player, locale);
  const matchRankContext = resolveMatchRankContext(match, locale);
  const resolvedSkillBracket =
    matchRankContext.skillBracket ?? playerRankContext.skillBracket;
  const resolvedSkillBracketTier =
    matchRankContext.skillBracketTier ?? playerRankContext.skillBracketTier;
  const rank =
    playerRankContext.playerRank ??
    matchRankContext.matchAverageRank ??
    resolvedSkillBracket ??
    locale.unknownRank;
  const rankKind = playerRankContext.playerRank
    ? 'playerRank'
    : matchRankContext.matchAverageRank
      ? 'matchAverageRank'
      : resolvedSkillBracket
        ? 'skillBracket'
        : 'unknown';
  const scepterTiming = resolveOwnedItemTiming(
    timeline,
    ['ultimate_scepter', 'ultimate_scepter_2', 'aghanims_scepter'],
    player.aghanims_scepter
  );
  const shardTiming = resolveOwnedItemTiming(
    timeline,
    ['aghanims_shard', 'aghanims_shard_roshan'],
    player.aghanims_shard
  );
  const abilityIssue =
    abilityResource.issue ??
    (abilityMeta?.issue || abilityMeta?.available === false
      ? createAccessIssue('abilityNames', {
          ...(abilityMeta?.issue ?? {}),
          message:
            lang === 'en'
              ? 'Ability names are unavailable; numeric ability identifiers are shown instead.'
              : '技能名称暂不可用，当前改为显示技能数字 ID。',
        })
      : null);
  const accessIssues = [
    itemResource.issue,
    abilityIssue,
    playerProfileCoverage.complete
      ? null
      : createAccessIssue('playerProfiles', {
          code: 'PLAYER_PROFILES_PARTIAL',
          resource: 'matchPlayers',
          retryable: false,
          message:
            lang === 'en'
              ? `${playerProfileCoverage.unavailable} public player profile(s) are unavailable; fallback labels are shown.`
              : `${playerProfileCoverage.unavailable} 位玩家的公开资料不可用，当前显示回退名称。`,
        }),
  ].filter(Boolean);
  const detailStartTime =
    normalizeUnixSeconds(match.start_time) ??
    normalizeUnixSeconds(fallback.startTime);

  return {
    matchId: match.match_id ?? matchId,
    heroId: player.hero_id ?? fallback.heroId ?? null,
    hero: heroMeta?.name ?? fallback.hero ?? `Hero #${player.hero_id}`,
    heroAvatar: heroMeta?.avatar ?? fallback.heroAvatar ?? '',
    overview: {
      result: outcome,
      startTime: detailStartTime,
      durationSec: match.duration ?? fallback.durationSec ?? 0,
      gameMode: resolveGameMode(match, locale),
      queueType: resolveQueueType(match, locale),
      laneRole: resolveRole(player, locale),
      rank,
      rankKind,
      playerRank: playerRankContext.playerRank,
      playerRankTier: playerRankContext.playerRankTier,
      matchAverageRank: matchRankContext.matchAverageRank,
      matchAverageRankTier: matchRankContext.matchAverageRankTier,
      skillBracket: resolvedSkillBracket,
      skillBracketTier: resolvedSkillBracketTier,
      kills,
      deaths,
      assists,
      kda,
      goldPerMin,
      xpPerMin,
      killParticipation,
      impactScore,
      rampageCount,
      godlikeCount,
      hasRampage: rampageCount > 0,
      hasGodlike: godlikeCount > 0,
      rampageDataAvailable,
      godlikeDataAvailable,
    },
    core: {
      heroDamage: toFiniteOrNull(player.hero_damage),
      towerDamage: toFiniteOrNull(player.tower_damage),
      heroHealing: toFiniteOrNull(player.hero_healing),
      stunDuration: toFiniteOrNull(player.stuns),
      lastHits: toFiniteOrNull(player.last_hits),
      denies: toFiniteOrNull(player.denies),
      netWorth: toFiniteOrNull(player.net_worth ?? player.total_gold),
      level: toFiniteOrNull(player.level),
    },
    build: {
      finalItems: ITEM_SLOTS.map((slot) => resolveItemNameById(player[`item_${slot}`], itemMeta)).filter(Boolean),
      neutralItem: resolveItemNameById(player.item_neutral, itemMeta),
      purchaseTimeline: timeline,
      skillBuild: buildSkillBuild(player, abilityMeta),
      scepterTimeSec: scepterTiming.acquiredAt,
      scepterOwned: scepterTiming.owned,
      scepterTimingAvailable: scepterTiming.timingAvailable,
      scepterTimingSource: scepterTiming.timingSource,
      shardTimeSec: shardTiming.acquiredAt,
      shardOwned: shardTiming.owned,
      shardTimingAvailable: shardTiming.timingAvailable,
      shardTimingSource: shardTiming.timingSource,
    },
    allPlayers: buildAllPlayers(players, heroesMetaMap, itemMeta, locale, player, fallback),
    playerIdentity: {
      matchedBy: playerIdentity.matchedBy,
      ambiguous: playerIdentity.ambiguous,
    },
    dataCoverage: {
      playerProfiles: playerProfileCoverage,
      abilityNames: {
        available: abilityMeta?.available === true,
        source: abilityMeta?.source ?? 'fallback',
      },
      itemMetadata: {
        available: !itemResource.issue,
      },
    },
    accessIssues,
    partial: accessIssues.length > 0,
    status: accessIssues.length > 0 ? 'partial' : 'complete',
  };
};

export const openDotaTesting = Object.freeze({
  buildAchievementTotalsFromMatches,
  buildDailyKdaTrend,
  buildDailyWinRate,
  buildHeroPerformance,
  buildMatchRows,
  buildRankDistribution,
  createWindowBoundary,
  isMatchInsideBoundary,
  mergeAchievementTotals,
  resolveCurrentPlayer,
  resolveImpactScore,
  resolveMatchOutcome,
  resolveOwnedItemTiming,
  summarizeKnownOutcomeDashboard,
});

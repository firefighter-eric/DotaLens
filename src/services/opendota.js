import { summarizeDashboard } from '../utils/metrics.js';
import { createOpenDotaClient } from './opendotaClient.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_MATCH_FETCH_LIMIT = 30;
const ITEM_SLOTS = [0, 1, 2, 3, 4, 5];
const SKILL_BUILD_LIMIT = 18;

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
      12: '技能征召',
      16: '队长征召',
      22: '全英雄随机死亡竞赛',
      23: '涡轮',
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
      12: 'Ability Draft',
      16: "Captain's Draft",
      22: 'All Random Deathmatch',
      23: 'Turbo',
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
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isMatchWin = (match) => {
  const isRadiant = match.player_slot < 128;
  return (isRadiant && match.radiant_win) || (!isRadiant && !match.radiant_win);
};

const isPlayerWinInMatch = (playerSlot, radiantWin) => {
  const isRadiant = Number(playerSlot) < 128;
  return (isRadiant && radiantWin) || (!isRadiant && !radiantWin);
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

const resolveRole = (match, locale) =>
  locale.laneRoleMap[match.lane_role] ?? (match.is_roaming ? locale.roamingRole : locale.unknownRole);
const resolveHeroAttribute = (heroMeta, locale) => locale.attributeMap[heroMeta?.primaryAttr] ?? locale.unknownAttribute;

const resolveRank = (match, locale) => {
  const rankTier = match.average_rank ?? match.average_rank_tier ?? match.rank_tier;
  if (rankTier) {
    const major = Math.floor(rankTier / 10);
    return locale.rankTierMap[major] ?? locale.unknownRank;
  }
  return locale.skillMap[match.skill] ?? locale.unknownRank;
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

const resolveAbilityName = (abilityId, abilityNameById) => {
  const id = Number.parseInt(String(abilityId), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return abilityNameById.get(id) ?? `Ability #${id}`;
};

const isSamePlayer = (player, accountId, playerSlot, heroId) => {
  if (!player || typeof player !== 'object') {
    return false;
  }

  if (player.account_id != null && String(player.account_id) === String(accountId)) {
    return true;
  }
  if (playerSlot != null && player.player_slot != null && Number(player.player_slot) === Number(playerSlot)) {
    return true;
  }
  if (heroId != null && player.hero_id != null && Number(player.hero_id) === Number(heroId)) {
    return true;
  }
  return false;
};

const resolveTeamKills = (players, playerSlot) => {
  const isRadiant = Number(playerSlot) < 128;
  return players.reduce((sum, player) => {
    if (!player || player.player_slot == null) {
      return sum;
    }
    const sameTeam = (player.player_slot < 128) === isRadiant;
    return sameTeam ? sum + (player.kills ?? 0) : sum;
  }, 0);
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

const buildSkillBuild = (player, abilityNameById) => {
  const withDetail = toArray(player.ability_upgrades)
    .filter((entry) => entry && entry.ability != null)
    .slice(0, SKILL_BUILD_LIMIT)
    .map((entry, index) => ({
      id: `ability-${index}-${entry.ability}`,
      level: Number(entry.level) || index + 1,
      abilityId: Number(entry.ability),
      ability: resolveAbilityName(entry.ability, abilityNameById),
      timeSec: Number.isFinite(Number(entry.time)) ? Math.max(0, Number(entry.time)) : null,
    }));

  if (withDetail.length > 0) {
    return withDetail;
  }

  return toArray(player.ability_upgrades_arr)
    .slice(0, SKILL_BUILD_LIMIT)
    .map((abilityId, index) => ({
      id: `ability-arr-${index}-${abilityId}`,
      level: index + 1,
      abilityId: Number(abilityId),
      ability: resolveAbilityName(abilityId, abilityNameById),
      timeSec: null,
    }));
};

const resolveImpactScore = (isWin, kda, goldPerMin, killParticipation) => {
  const winBoost = isWin ? 14 : 0;
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

const buildAllPlayers = (players, heroesMetaMap, itemMeta, locale, accountId, fallback = {}) => {
  const teamSummary = players.reduce(
    (acc, player) => {
      if (!player || player.player_slot == null) {
        return acc;
      }
      const team = player.player_slot < 128 ? 'radiant' : 'dire';
      acc[team].kills += player.kills ?? 0;
      acc[team].heroDamage += toFiniteOrNull(player.hero_damage) ?? 0;
      acc[team].netWorth += toFiniteOrNull(player.net_worth ?? player.total_gold) ?? 0;
      return acc;
    },
    {
      radiant: { kills: 0, heroDamage: 0, netWorth: 0 },
      dire: { kills: 0, heroDamage: 0, netWorth: 0 },
    }
  );

  return players
    .filter((entry) => entry && entry.hero_id != null && entry.player_slot != null)
    .map((entry) => {
      const heroMeta = heroesMetaMap.get(entry.hero_id);
      const kills = entry.kills ?? 0;
      const deaths = entry.deaths ?? 0;
      const assists = entry.assists ?? 0;
      const team = entry.player_slot < 128 ? 'radiant' : 'dire';
      const currentTeam = teamSummary[team];
      const heroDamage = toFiniteOrNull(entry.hero_damage);
      const isCurrentPlayer = isSamePlayer(entry, accountId, fallback.playerSlot, fallback.heroId);
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
        playerName: resolvePlayerDisplayName(entry, locale),
        playerAvatar: resolvePlayerAvatar(entry, isCurrentPlayer ? fallback.playerAvatar : ''),
        team,
        heroId: entry.hero_id,
        hero: heroMeta?.name ?? `Hero #${entry.hero_id}`,
        heroAvatar: heroMeta?.avatar ?? '',
        laneRole: resolveRole(entry, locale),
        rank: resolveRank(entry, locale),
        kills,
        deaths,
        assists,
        kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
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
          currentTeam.kills > 0 ? Number((((kills + assists) / currentTeam.kills) * 100).toFixed(1)) : null,
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
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      gpm: 0,
      gpmMatches: 0,
      xpm: 0,
      xpmMatches: 0,
      roleCount: {},
    };

    record.matches += 1;
    record.wins += isMatchWin(match) ? 1 : 0;
    record.kills += match.kills ?? 0;
    record.deaths += match.deaths ?? 0;
    record.assists += match.assists ?? 0;
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
      const avgKda = (record.kills + record.assists) / Math.max(1, record.deaths);
      const avgGpm = record.gpmMatches > 0 ? Math.round(record.gpm / record.gpmMatches) : null;
      const avgXpm = record.xpmMatches > 0 ? Math.round(record.xpm / record.xpmMatches) : null;
      const winRate = (record.wins / record.matches) * 100;
      const gpmImpact = avgGpm === null ? 0 : avgGpm / 24;
      const impact = clamp(Math.round(winRate * 0.55 + avgKda * 8 + gpmImpact), 0, 99);

      return {
        heroId: record.heroId,
        hero: record.hero,
        heroAvatar: record.heroAvatar,
        attribute: record.attribute,
        role: getMainRole(record.roleCount, locale.unknownRole),
        matches: record.matches,
        wins: record.wins,
        avgKda: Number(avgKda.toFixed(2)),
        avgGpm,
        avgXpm,
        impact,
      };
    })
    .sort((a, b) => b.matches - a.matches);
};

const buildMatchRows = (matches, heroesMetaMap, locale) =>
  matches
    .filter((match) => match.start_time && match.match_id)
    .slice()
    .sort((a, b) => b.start_time - a.start_time)
    .map((match) => {
      const heroMeta = heroesMetaMap.get(match.hero_id);
      const kills = match.kills ?? 0;
      const deaths = match.deaths ?? 0;
      const assists = match.assists ?? 0;

      return {
        matchId: match.match_id,
        startTime: match.start_time,
        playerSlot: match.player_slot ?? null,
        heroId: match.hero_id,
        hero: heroMeta?.name ?? `Hero #${match.hero_id}`,
        heroAvatar: heroMeta?.avatar ?? '',
        result: isMatchWin(match) ? 'win' : 'loss',
        kills,
        deaths,
        assists,
        kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
        goldPerMin: toFiniteOrNull(match.gold_per_min),
        xpPerMin: toFiniteOrNull(match.xp_per_min),
        heroDamage: toFiniteOrNull(match.hero_damage),
        durationSec: match.duration ?? 0,
        laneRole: resolveRole(match, locale),
        rank: resolveRank(match, locale),
      };
    });

const buildRecentMatches = (matches, heroesMetaMap, locale, limit = RECENT_MATCH_FETCH_LIMIT) =>
  buildMatchRows(matches, heroesMetaMap, locale).slice(0, limit);

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

  const [player, matches, latestMatches, heroesMetaMap] = await Promise.all([
    client.getPlayer(accountId, signal),
    client.getPlayerMatchesByDays(accountId, days, signal),
    client.getPlayerLatestMatches(accountId, RECENT_MATCH_FETCH_LIMIT, signal).catch(() => []),
    client.getHeroesMetaMap(signal),
  ]);

  const recentMatches = buildRecentMatches(latestMatches, heroesMetaMap, locale);
  const validMatches = matches.filter((item) => item.start_time);
  const windowMatches = buildMatchRows(validMatches, heroesMetaMap, locale);
  if (validMatches.length === 0) {
    return {
      playerName: player?.profile?.personaname ?? locale.playerFallback(accountId),
      playerAvatar: resolvePlayerAvatar(player),
      heroPerformance: [],
      dailyWinRate: [],
      rankDistribution: [],
      recentMatches,
      windowMatches: [],
      metrics: summarizeDashboard([]),
      totalMatches: 0,
      latestMatchStartTime: recentMatches[0]?.startTime ?? null,
    };
  }

  const heroPerformance = buildHeroPerformance(validMatches, heroesMetaMap, locale);
  const dailyWinRate = buildDailyWinRate(validMatches, days);
  const rankDistribution = buildRankDistribution(validMatches, locale);

  return {
    playerName: player?.profile?.personaname ?? locale.playerFallback(accountId),
    playerAvatar: resolvePlayerAvatar(player),
    heroPerformance,
    dailyWinRate,
    rankDistribution,
    recentMatches,
    windowMatches,
    metrics: summarizeDashboard(heroPerformance),
    totalMatches: validMatches.length,
    latestMatchStartTime: validMatches[0]?.start_time ?? null,
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

  const [match, heroesMetaMap, itemMeta, abilityNameById] = await Promise.all([
    client.getMatchById(matchId, signal),
    client.getHeroesMetaMap(signal),
    client
      .getItemMeta(signal)
      .catch(() => ({ nameById: new Map(), nameByKey: new Map(), itemById: new Map(), itemByKey: new Map() })),
    client.getAbilityNameById(signal).catch(() => new Map()),
  ]);

  const players = toArray(match.players);
  const player =
    players.find((entry) => isSamePlayer(entry, accountId, fallback.playerSlot, fallback.heroId)) ?? players[0] ?? null;

  if (!player) {
    throw new Error(lang === 'en' ? 'Match detail is unavailable.' : '当前比赛详情不可用。');
  }

  const isWin = isPlayerWinInMatch(player.player_slot, match.radiant_win);
  const kills = player.kills ?? 0;
  const deaths = player.deaths ?? 0;
  const assists = player.assists ?? 0;
  const kda = Number(((kills + assists) / Math.max(1, deaths)).toFixed(2));
  const goldPerMin = toFiniteOrNull(player.gold_per_min);
  const xpPerMin = toFiniteOrNull(player.xp_per_min);
  const teamKills = resolveTeamKills(players, player.player_slot);
  const killParticipation = teamKills > 0 ? Number((((kills + assists) / teamKills) * 100).toFixed(1)) : null;
  const timeline = buildPurchaseTimeline(player, itemMeta);

  const heroMeta = heroesMetaMap.get(player.hero_id);
  const impactScore = resolveImpactScore(isWin, kda, goldPerMin, killParticipation);

  return {
    matchId: match.match_id ?? matchId,
    heroId: player.hero_id ?? fallback.heroId ?? null,
    hero: heroMeta?.name ?? fallback.hero ?? `Hero #${player.hero_id}`,
    heroAvatar: heroMeta?.avatar ?? fallback.heroAvatar ?? '',
    overview: {
      result: isWin ? 'win' : 'loss',
      startTime: match.start_time ?? fallback.startTime ?? null,
      durationSec: match.duration ?? fallback.durationSec ?? 0,
      gameMode: resolveGameMode(match, locale),
      queueType: resolveQueueType(match, locale),
      laneRole: resolveRole(player, locale),
      rank: resolveRank(player, locale),
      kills,
      deaths,
      assists,
      kda,
      goldPerMin,
      xpPerMin,
      killParticipation,
      impactScore,
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
      skillBuild: buildSkillBuild(player, abilityNameById),
      scepterTimeSec:
        resolvePurchaseTime(timeline, ['ultimate_scepter', 'ultimate_scepter_2', 'aghanims_scepter']) ??
        (player.aghanims_scepter ? 0 : null),
      shardTimeSec:
        resolvePurchaseTime(timeline, ['aghanims_shard', 'aghanims_shard_roshan']) ?? (player.aghanims_shard ? 0 : null),
    },
    allPlayers: buildAllPlayers(players, heroesMetaMap, itemMeta, locale, accountId, fallback),
  };
};

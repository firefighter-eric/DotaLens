export const toPercent = (wins, matches) => {
  if (!matches) {
    return '0.0';
  }
  return ((wins / matches) * 100).toFixed(1);
};

const toFiniteOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toOverviewMatch = (entry) => {
  if (!entry?.match) {
    return null;
  }

  return {
    matchId: entry.match.matchId ?? null,
    hero: entry.match.hero ?? '-',
    heroAvatar: entry.match.heroAvatar ?? '',
    startTime: entry.match.startTime ?? null,
    result: entry.match.result ?? null,
    kills: toFiniteOrNull(entry.match.kills),
    deaths: toFiniteOrNull(entry.match.deaths),
    assists: toFiniteOrNull(entry.match.assists),
    value: entry.value,
  };
};

const pickMaxMatch = (matches, valueSelector) =>
  matches.reduce((best, match) => {
    const value = valueSelector(match);
    if (value === null) {
      return best;
    }
    if (!best) {
      return { match, value };
    }
    if (value > best.value) {
      return { match, value };
    }
    if (value < best.value) {
      return best;
    }

    const currentStartTime = Number(match.startTime ?? 0);
    const bestStartTime = Number(best.match.startTime ?? 0);
    if (currentStartTime > bestStartTime) {
      return { match, value };
    }
    if (currentStartTime < bestStartTime) {
      return best;
    }

    const currentMatchId = Number(match.matchId ?? 0);
    const bestMatchId = Number(best.match.matchId ?? 0);
    return currentMatchId >= bestMatchId ? { match, value } : best;
  }, null);

export const summarizeOverviewExtremes = (matches) => {
  const safeMatches = Array.isArray(matches) ? matches : [];

  return {
    highestDamageMatch: toOverviewMatch(pickMaxMatch(safeMatches, (match) => toFiniteOrNull(match.heroDamage))),
    mostKillsMatch: toOverviewMatch(pickMaxMatch(safeMatches, (match) => toFiniteOrNull(match.kills))),
    mostDeathsMatch: toOverviewMatch(pickMaxMatch(safeMatches, (match) => toFiniteOrNull(match.deaths))),
  };
};

const summarizeStreaks = (matches) => {
  const safeMatches = Array.isArray(matches) ? matches : [];
  if (!safeMatches.length) {
    return {
      longestWinStreak: 0,
      longestLossStreak: 0,
    };
  }

  const sortedMatches = [...safeMatches].sort((a, b) => {
    const startA = Number(a?.startTime ?? 0);
    const startB = Number(b?.startTime ?? 0);
    if (startA !== startB) {
      return startA - startB;
    }
    return Number(a?.matchId ?? 0) - Number(b?.matchId ?? 0);
  });

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  sortedMatches.forEach((match) => {
    if (match?.result === 'win') {
      currentWinStreak += 1;
      currentLossStreak = 0;
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak;
      }
      return;
    }

    if (match?.result === 'loss') {
      currentLossStreak += 1;
      currentWinStreak = 0;
      if (currentLossStreak > longestLossStreak) {
        longestLossStreak = currentLossStreak;
      }
      return;
    }

    currentWinStreak = 0;
    currentLossStreak = 0;
  });

  return {
    longestWinStreak,
    longestLossStreak,
  };
};

export const summarizeDashboard = (heroData, windowMatches = []) => {
  const streaks = summarizeStreaks(windowMatches);

  if (!heroData.length) {
    return {
      totalMatches: 0,
      overallWinRate: '0.0',
      avgKda: '0.00',
      avgGpm: null,
      longestWinStreak: streaks.longestWinStreak,
      longestLossStreak: streaks.longestLossStreak,
      bestHero: {
        hero: '-',
        impact: 0,
        avgGpm: null,
      },
      worstHero: {
        hero: '-',
        impact: 0,
        avgGpm: null,
      },
      mostPlayedHero: {
        hero: '-',
        matches: 0,
        winRate: '0.0',
      },
    };
  }

  const totals = heroData.reduce(
    (acc, hero) => {
      acc.matches += hero.matches;
      acc.wins += hero.wins;
      const kills = toFiniteOrNull(hero.kills);
      const deaths = toFiniteOrNull(hero.deaths);
      const assists = toFiniteOrNull(hero.assists);
      if (kills !== null && deaths !== null && assists !== null) {
        acc.totalKa += kills + assists;
        acc.totalDeaths += deaths;
      }
      const matches = toFiniteOrNull(hero.matches);
      if (Number.isFinite(hero.avgGpm) && matches !== null && matches > 0) {
        acc.gpm += hero.avgGpm * matches;
        acc.gpmCount += matches;
      }
      return acc;
    },
    { matches: 0, wins: 0, totalKa: 0, totalDeaths: 0, gpm: 0, gpmCount: 0 }
  );

  const bestHero = [...heroData].sort((a, b) => b.impact - a.impact)[0];
  const worstHero = [...heroData].sort((a, b) => a.impact - b.impact)[0];
  const mostPlayedHero = [...heroData].sort((a, b) => b.matches - a.matches)[0];

  return {
    totalMatches: totals.matches,
    overallWinRate: toPercent(totals.wins, totals.matches),
    avgKda: (totals.totalKa / Math.max(1, totals.totalDeaths)).toFixed(2),
    avgGpm: totals.gpmCount > 0 ? Math.round(totals.gpm / totals.gpmCount) : null,
    longestWinStreak: streaks.longestWinStreak,
    longestLossStreak: streaks.longestLossStreak,
    bestHero,
    worstHero,
    mostPlayedHero: {
      hero: mostPlayedHero.hero,
      matches: mostPlayedHero.matches,
      winRate: toPercent(mostPlayedHero.wins, mostPlayedHero.matches),
    },
  };
};

export const buildRoleDistribution = (heroData) => {
  if (!heroData.length) {
    return [];
  }

  const roleMap = heroData.reduce((acc, hero) => {
    const role = hero.role || '-';
    acc.set(role, (acc.get(role) ?? 0) + hero.matches);
    return acc;
  }, new Map());

  const totalMatches = Array.from(roleMap.values()).reduce((sum, count) => sum + count, 0);
  if (!totalMatches) {
    return [];
  }

  return Array.from(roleMap.entries())
    .map(([role, matches]) => ({
      role,
      matches,
      ratio: Number(((matches / totalMatches) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.ratio - a.ratio);
};

export const summarizeRecentMatches = (matches) => {
  if (!matches.length) {
    return {
      total: 0,
      wins: 0,
      winRate: '0.0',
      avgKda: '0.00',
      avgGpm: null,
      avgDurationMin: 0,
    };
  }

  const totals = matches.reduce(
    (acc, match) => {
      acc.wins += match.result === 'win' ? 1 : 0;
      acc.kills += match.kills ?? 0;
      acc.deaths += match.deaths ?? 0;
      acc.assists += match.assists ?? 0;
      if (Number.isFinite(match.goldPerMin)) {
        acc.gpm += match.goldPerMin;
        acc.gpmCount += 1;
      }
      acc.durationSec += match.durationSec ?? 0;
      return acc;
    },
    { wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, gpmCount: 0, durationSec: 0 }
  );

  return {
    total: matches.length,
    wins: totals.wins,
    winRate: toPercent(totals.wins, matches.length),
    avgKda: ((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(2),
    avgGpm: totals.gpmCount > 0 ? Math.round(totals.gpm / totals.gpmCount) : null,
    avgDurationMin: Math.round(totals.durationSec / matches.length / 60),
  };
};

export const buildGameModeDistribution = (matches, unknownModeLabel = 'Unknown') => {
  const safeMatches = Array.isArray(matches) ? matches : [];
  if (!safeMatches.length) {
    return [];
  }

  const modeCounter = safeMatches.reduce((acc, match) => {
    const normalizedMode = String(match?.gameMode ?? '')
      .trim();
    const mode = normalizedMode || unknownModeLabel;
    acc.set(mode, (acc.get(mode) ?? 0) + 1);
    return acc;
  }, new Map());

  const totalMatches = Array.from(modeCounter.values()).reduce((sum, count) => sum + count, 0);
  if (!totalMatches) {
    return [];
  }

  return Array.from(modeCounter.entries())
    .map(([mode, count]) => ({
      mode,
      matches: count,
      ratio: Number(((count / totalMatches) * 100).toFixed(1)),
    }))
    .sort((a, b) => {
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return a.mode.localeCompare(b.mode);
    });
};

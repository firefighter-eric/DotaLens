export const toPercent = (wins, matches) => {
  if (!matches) {
    return '0.0';
  }
  return ((wins / matches) * 100).toFixed(1);
};

const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const resolveHeroWinRate = (hero) => {
  const knownOutcomes = toFiniteOrNull(hero?.outcomeMatches);
  if (knownOutcomes !== null && knownOutcomes <= 0) {
    return null;
  }

  const explicit = toFiniteOrNull(hero?.winRate);
  if (explicit !== null) {
    return explicit;
  }

  const denominator = knownOutcomes ?? toFiniteOrNull(hero?.matches);
  const wins = toFiniteOrNull(hero?.wins) ?? 0;
  return denominator !== null && denominator > 0 ? (wins / denominator) * 100 : null;
};

export const formatHeroWinRate = (hero, emptyValue = '-') => {
  const winRate = resolveHeroWinRate(hero);
  return winRate === null ? emptyValue : `${winRate.toFixed(1)}%`;
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
      overallWinRate: null,
      avgKda: null,
      avgGpm: null,
      avgXpm: null,
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
        matches: 0,
        outcomeMatches: 0,
        winRate: null,
        heroAvatar: '',
      },
      mostPlayedHero: {
        hero: '-',
        heroAvatar: '',
        matches: 0,
        outcomeMatches: 0,
        winRate: null,
      },
      signatureHero: {
        hero: '-',
        heroAvatar: '',
        matches: 0,
        outcomeMatches: 0,
        winRate: null,
      },
      antiSignatureHero: {
        hero: '-',
        heroAvatar: '',
        matches: 0,
        outcomeMatches: 0,
        winRate: null,
      },
    };
  }

  const totals = heroData.reduce(
    (acc, hero) => {
      const matches = Math.max(0, toFiniteOrNull(hero.matches) ?? 0);
      const outcomeMatches = Math.max(
        0,
        toFiniteOrNull(hero.outcomeMatches) ?? matches
      );
      const wins = Math.min(
        outcomeMatches,
        Math.max(0, toFiniteOrNull(hero.wins) ?? 0)
      );
      acc.matches += matches;
      acc.outcomeMatches += outcomeMatches;
      acc.wins += wins;
      const kills = toFiniteOrNull(hero.kills);
      const deaths = toFiniteOrNull(hero.deaths);
      const assists = toFiniteOrNull(hero.assists);
      const kdaMatches = Math.max(
        0,
        toFiniteOrNull(hero.kdaMatches) ?? matches
      );
      if (
        kdaMatches > 0 &&
        kills !== null &&
        deaths !== null &&
        assists !== null
      ) {
        acc.totalKa += kills + assists;
        acc.totalDeaths += deaths;
        acc.kdaMatches += kdaMatches;
      }
      const gpmMatches = Math.max(
        0,
        toFiniteOrNull(hero.gpmMatches) ?? matches
      );
      if (Number.isFinite(hero.avgGpm) && gpmMatches > 0) {
        acc.gpm += hero.avgGpm * gpmMatches;
        acc.gpmCount += gpmMatches;
      }
      const xpmMatches = Math.max(
        0,
        toFiniteOrNull(hero.xpmMatches) ?? matches
      );
      if (Number.isFinite(hero.avgXpm) && xpmMatches > 0) {
        acc.xpm += hero.avgXpm * xpmMatches;
        acc.xpmCount += xpmMatches;
      }
      return acc;
    },
    {
      matches: 0,
      outcomeMatches: 0,
      wins: 0,
      totalKa: 0,
      totalDeaths: 0,
      kdaMatches: 0,
      gpm: 0,
      gpmCount: 0,
      xpm: 0,
      xpmCount: 0,
    }
  );

  const bestHero = [...heroData].sort((a, b) => b.impact - a.impact)[0];
  const worstHeroCandidates = heroData.filter(
    (hero) =>
      (toFiniteOrNull(hero?.outcomeMatches) ??
        toFiniteOrNull(hero?.matches) ??
        0) >= 2
  );
  const worstHero =
    (worstHeroCandidates.length > 0
      ? [...worstHeroCandidates].sort((a, b) => {
          const aWinRate = resolveHeroWinRate(a) ?? Number.POSITIVE_INFINITY;
          const bWinRate = resolveHeroWinRate(b) ?? Number.POSITIVE_INFINITY;
          if (aWinRate !== bWinRate) {
            return aWinRate - bWinRate;
          }
          if (b.matches !== a.matches) {
            return b.matches - a.matches;
          }
          return String(a.hero ?? '').localeCompare(String(b.hero ?? ''));
        })[0]
      : null) ?? {
      hero: '-',
      impact: 0,
      avgGpm: null,
      matches: 0,
      wins: 0,
      heroAvatar: '',
    };
  const mostPlayedHero = [...heroData].sort((a, b) => b.matches - a.matches)[0];
  const topByMatches = [...heroData].sort((a, b) => b.matches - a.matches);
  const topTenPercentCount = Math.max(1, Math.ceil(topByMatches.length * 0.1));
  const signatureCandidates = topByMatches
    .slice(0, topTenPercentCount)
    .filter(
      (hero) =>
        (toFiniteOrNull(hero?.outcomeMatches) ??
          toFiniteOrNull(hero?.matches) ??
          0) >= 2
    );
  const signatureHero = signatureCandidates
    .slice()
    .sort((a, b) => {
      const winRateDiff =
        (resolveHeroWinRate(b) ?? Number.NEGATIVE_INFINITY) -
        (resolveHeroWinRate(a) ?? Number.NEGATIVE_INFINITY);
      if (winRateDiff !== 0) {
        return winRateDiff;
      }
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return String(a.hero ?? '').localeCompare(String(b.hero ?? ''));
    })[0] ?? null;
  const antiSignatureHero = signatureCandidates
    .slice()
    .sort((a, b) => {
      const winRateDiff =
        (resolveHeroWinRate(a) ?? Number.POSITIVE_INFINITY) -
        (resolveHeroWinRate(b) ?? Number.POSITIVE_INFINITY);
      if (winRateDiff !== 0) {
        return winRateDiff;
      }
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return String(a.hero ?? '').localeCompare(String(b.hero ?? ''));
    })[0] ?? null;
  const emptyHeroSummary = {
    hero: '-',
    heroAvatar: '',
    matches: 0,
    outcomeMatches: 0,
    winRate: null,
  };
  const toHeroSummary = (hero) =>
    hero
      ? {
          hero: hero.hero,
          heroAvatar: hero.heroAvatar ?? '',
          matches: hero.matches,
          outcomeMatches:
            toFiniteOrNull(hero.outcomeMatches) ??
            toFiniteOrNull(hero.matches) ??
            0,
          winRate:
            resolveHeroWinRate(hero) === null
              ? null
              : resolveHeroWinRate(hero).toFixed(1),
        }
      : emptyHeroSummary;

  return {
    totalMatches: totals.matches,
    overallWinRate:
      totals.outcomeMatches > 0 ? toPercent(totals.wins, totals.outcomeMatches) : null,
    avgKda:
      totals.kdaMatches > 0
        ? (totals.totalKa / Math.max(1, totals.totalDeaths)).toFixed(2)
        : null,
    avgGpm: totals.gpmCount > 0 ? Math.round(totals.gpm / totals.gpmCount) : null,
    avgXpm: totals.xpmCount > 0 ? Math.round(totals.xpm / totals.xpmCount) : null,
    longestWinStreak: streaks.longestWinStreak,
    longestLossStreak: streaks.longestLossStreak,
    bestHero,
    worstHero,
    mostPlayedHero: toHeroSummary(mostPlayedHero),
    signatureHero: toHeroSummary(signatureHero),
    antiSignatureHero: toHeroSummary(antiSignatureHero),
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

export const summarizeSideWinRates = (matches) => {
  const safeMatches = Array.isArray(matches) ? matches : [];
  const totals = safeMatches.reduce(
    (acc, match) => {
      if (match?.playerSlot == null || match.playerSlot === '') {
        return acc;
      }
      const playerSlot = Number(match?.playerSlot);
      if (!Number.isFinite(playerSlot) || (match?.result !== 'win' && match?.result !== 'loss')) {
        return acc;
      }

      const side = playerSlot < 128 ? 'radiant' : 'dire';
      acc[side].matches += 1;
      acc[side].wins += match.result === 'win' ? 1 : 0;
      return acc;
    },
    {
      radiant: { wins: 0, matches: 0 },
      dire: { wins: 0, matches: 0 },
    }
  );

  return {
    radiant: {
      wins: totals.radiant.wins,
      matches: totals.radiant.matches,
      winRate: totals.radiant.matches > 0 ? toPercent(totals.radiant.wins, totals.radiant.matches) : null,
    },
    dire: {
      wins: totals.dire.wins,
      matches: totals.dire.matches,
      winRate: totals.dire.matches > 0 ? toPercent(totals.dire.wins, totals.dire.matches) : null,
    },
  };
};

export const summarizeRecentMatches = (matches) => {
  if (!matches.length) {
    return {
      total: 0,
      ratedTotal: 0,
      unknownResults: 0,
      wins: 0,
      winRate: null,
      avgKda: null,
      avgGpm: null,
      avgDurationMin: null,
    };
  }

  const totals = matches.reduce(
    (acc, match) => {
      if (match.result === 'win' || match.result === 'loss') {
        acc.ratedTotal += 1;
        acc.wins += match.result === 'win' ? 1 : 0;
      } else {
        acc.unknownResults += 1;
      }
      const kills = toFiniteOrNull(match.kills);
      const deaths = toFiniteOrNull(match.deaths);
      const assists = toFiniteOrNull(match.assists);
      if (kills !== null && deaths !== null && assists !== null) {
        acc.kills += kills;
        acc.deaths += deaths;
        acc.assists += assists;
        acc.kdaMatches += 1;
      }
      if (Number.isFinite(match.goldPerMin)) {
        acc.gpm += match.goldPerMin;
        acc.gpmCount += 1;
      }
      const durationSec = toFiniteOrNull(match.durationSec);
      if (durationSec !== null && durationSec > 0) {
        acc.durationSec += durationSec;
        acc.durationMatches += 1;
      }
      return acc;
    },
    {
      ratedTotal: 0,
      unknownResults: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      kdaMatches: 0,
      gpm: 0,
      gpmCount: 0,
      durationSec: 0,
      durationMatches: 0,
    }
  );

  return {
    total: matches.length,
    ratedTotal: totals.ratedTotal,
    unknownResults: totals.unknownResults,
    wins: totals.wins,
    winRate: totals.ratedTotal > 0 ? toPercent(totals.wins, totals.ratedTotal) : null,
    avgKda:
      totals.kdaMatches > 0
        ? ((totals.kills + totals.assists) / Math.max(1, totals.deaths)).toFixed(2)
        : null,
    avgGpm: totals.gpmCount > 0 ? Math.round(totals.gpm / totals.gpmCount) : null,
    avgDurationMin:
      totals.durationMatches > 0
        ? Math.round(totals.durationSec / totals.durationMatches / 60)
        : null,
  };
};

export const buildHourlyMatchDistribution = (matches) => {
  const safeMatches = Array.isArray(matches) ? matches : [];
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({ hour, matches: 0 }));

  safeMatches.forEach((match) => {
    const startTime = Number(match?.startTime);
    if (!Number.isFinite(startTime) || startTime <= 0) {
      return;
    }

    const hour = new Date(startTime * 1000).getHours();
    if (hour >= 0 && hour <= 23) {
      hourlyCounts[hour].matches += 1;
    }
  });

  const totalMatches = hourlyCounts.reduce((sum, entry) => sum + entry.matches, 0);
  return hourlyCounts.map((entry) => ({
    ...entry,
    ratio: totalMatches > 0 ? Number(((entry.matches / totalMatches) * 100).toFixed(1)) : 0,
  }));
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

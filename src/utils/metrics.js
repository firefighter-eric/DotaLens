export const toPercent = (wins, matches) => {
  if (!matches) {
    return '0.0';
  }
  return ((wins / matches) * 100).toFixed(1);
};

export const summarizeDashboard = (heroData) => {
  if (!heroData.length) {
    return {
      totalMatches: 0,
      overallWinRate: '0.0',
      avgKda: '0.00',
      avgGpm: null,
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
      acc.kda += hero.avgKda;
      if (Number.isFinite(hero.avgGpm)) {
        acc.gpm += hero.avgGpm;
        acc.gpmCount += 1;
      }
      return acc;
    },
    { matches: 0, wins: 0, kda: 0, gpm: 0, gpmCount: 0 }
  );

  const bestHero = [...heroData].sort((a, b) => b.impact - a.impact)[0];
  const worstHero = [...heroData].sort((a, b) => a.impact - b.impact)[0];
  const mostPlayedHero = [...heroData].sort((a, b) => b.matches - a.matches)[0];

  return {
    totalMatches: totals.matches,
    overallWinRate: toPercent(totals.wins, totals.matches),
    avgKda: (totals.kda / heroData.length).toFixed(2),
    avgGpm: totals.gpmCount > 0 ? Math.round(totals.gpm / totals.gpmCount) : null,
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
      acc.kda += match.kda ?? 0;
      if (Number.isFinite(match.goldPerMin)) {
        acc.gpm += match.goldPerMin;
        acc.gpmCount += 1;
      }
      acc.durationSec += match.durationSec ?? 0;
      return acc;
    },
    { wins: 0, kda: 0, gpm: 0, gpmCount: 0, durationSec: 0 }
  );

  return {
    total: matches.length,
    wins: totals.wins,
    winRate: toPercent(totals.wins, matches.length),
    avgKda: (totals.kda / matches.length).toFixed(2),
    avgGpm: totals.gpmCount > 0 ? Math.round(totals.gpm / totals.gpmCount) : null,
    avgDurationMin: Math.round(totals.durationSec / matches.length / 60),
  };
};

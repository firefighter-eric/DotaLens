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
      avgGpm: 0,
      bestHero: {
        hero: '-',
        impact: 0,
        avgGpm: 0,
      },
    };
  }

  const totals = heroData.reduce(
    (acc, hero) => {
      acc.matches += hero.matches;
      acc.wins += hero.wins;
      acc.kda += hero.avgKda;
      acc.gpm += hero.avgGpm;
      return acc;
    },
    { matches: 0, wins: 0, kda: 0, gpm: 0 }
  );

  const bestHero = [...heroData].sort((a, b) => b.impact - a.impact)[0];

  return {
    totalMatches: totals.matches,
    overallWinRate: toPercent(totals.wins, totals.matches),
    avgKda: (totals.kda / heroData.length).toFixed(2),
    avgGpm: Math.round(totals.gpm / heroData.length),
    bestHero,
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

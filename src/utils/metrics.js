export const toPercent = (wins, matches) => ((wins / matches) * 100).toFixed(1);

export const summarizeDashboard = (heroData) => {
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

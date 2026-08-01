const FORMULA_VERSION = 'coach:v1';

const toFinite = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const confidenceForSample = (sampleSize) => {
  if (sampleSize >= 20) {
    return 'high';
  }
  if (sampleSize >= 10) {
    return 'medium';
  }
  return 'low';
};

const validMatches = (matches) =>
  (Array.isArray(matches) ? matches : []).filter(
    (match) => match && (match.result === 'win' || match.result === 'loss')
  );

const winRate = (matches) => {
  if (matches.length === 0) {
    return null;
  }
  const wins = matches.reduce((total, match) => total + (match.result === 'win' ? 1 : 0), 0);
  return round((wins / matches.length) * 100);
};

const buildMomentumInsight = (matches) => {
  const sample = matches.slice(0, 20);
  if (sample.length < 10) {
    return null;
  }

  const recent = sample.slice(0, Math.min(10, sample.length));
  const previous = sample.slice(recent.length);
  if (previous.length < 5) {
    return null;
  }

  const recentWinRate = winRate(recent);
  const previousWinRate = winRate(previous);
  const delta = round(recentWinRate - previousWinRate);
  return {
    id: 'momentum',
    tone: delta >= 5 ? 'positive' : delta <= -5 ? 'warning' : 'neutral',
    sampleSize: sample.length,
    confidence: confidenceForSample(sample.length),
    formulaVersion: FORMULA_VERSION,
    metrics: {
      recentWinRate,
      previousWinRate,
      delta,
      recentMatches: recent.length,
      previousMatches: previous.length,
    },
    evidenceMatchIds: recent.slice(0, 3).map((match) => match.matchId).filter(Boolean),
  };
};

const buildSurvivalInsight = (matches) => {
  const withDeaths = matches
    .map((match) => ({ ...match, normalizedDeaths: toFinite(match.deaths) }))
    .filter((match) => match.normalizedDeaths !== null);
  if (withDeaths.length < 5) {
    return null;
  }

  const sample = withDeaths.slice(0, 20);
  const averageDeaths = round(
    sample.reduce((total, match) => total + match.normalizedDeaths, 0) / sample.length
  );
  const evidence = sample
    .slice()
    .sort((a, b) => b.normalizedDeaths - a.normalizedDeaths)
    .slice(0, 3)
    .map((match) => match.matchId)
    .filter(Boolean);

  return {
    id: 'survival',
    tone: averageDeaths >= 8 ? 'warning' : averageDeaths <= 5 ? 'positive' : 'neutral',
    sampleSize: sample.length,
    confidence: confidenceForSample(sample.length),
    formulaVersion: FORMULA_VERSION,
    metrics: {
      averageDeaths,
      targetDeaths: averageDeaths >= 8 ? 7 : null,
    },
    evidenceMatchIds: evidence,
  };
};

const buildHeroFocusInsight = (heroPerformance, matches) => {
  const candidates = (Array.isArray(heroPerformance) ? heroPerformance : [])
    .map((hero) => {
      const totalMatches = Math.max(0, Math.trunc(toFinite(hero.matches) ?? 0));
      const matchesCount = Math.max(
        0,
        Math.trunc(toFinite(hero.outcomeMatches) ?? totalMatches)
      );
      const wins = Math.max(0, Math.trunc(toFinite(hero.wins) ?? 0));
      return {
        ...hero,
        totalMatches,
        matchesCount,
        computedWinRate: matchesCount > 0 ? round((wins / matchesCount) * 100) : null,
      };
    })
    .filter((hero) => hero.matchesCount >= 5 && hero.computedWinRate !== null)
    .sort((a, b) => {
      const scoreA = a.computedWinRate + Math.min(a.matchesCount, 20) * 0.35;
      const scoreB = b.computedWinRate + Math.min(b.matchesCount, 20) * 0.35;
      return scoreB - scoreA;
    });

  const hero = candidates[0];
  if (!hero) {
    return null;
  }

  const heroMatches = matches.filter(
    (match) =>
      (hero.heroId != null && match.heroId === hero.heroId) ||
      (hero.hero && match.hero === hero.hero)
  );

  return {
    id: 'heroFocus',
    tone: hero.computedWinRate >= 55 ? 'positive' : hero.computedWinRate < 45 ? 'warning' : 'neutral',
    sampleSize: hero.matchesCount,
    confidence: confidenceForSample(hero.matchesCount),
    formulaVersion: FORMULA_VERSION,
    metrics: {
      hero: hero.hero,
      heroId: hero.heroId ?? null,
      matches: hero.matchesCount,
      totalMatches: hero.totalMatches,
      winRate: hero.computedWinRate,
    },
    evidenceMatchIds: heroMatches.slice(0, 3).map((match) => match.matchId).filter(Boolean),
  };
};

/**
 * Produces bounded, auditable coaching signals. These are descriptive signals,
 * not causal claims: each item includes its sample size, formula version and
 * evidence match ids so the UI can explain why it was shown.
 */
export function buildCoachInsights({ heroPerformance = [], windowMatches = [] } = {}) {
  const matches = validMatches(windowMatches);
  return [
    buildMomentumInsight(matches),
    buildSurvivalInsight(matches),
    buildHeroFocusInsight(heroPerformance, matches),
  ].filter(Boolean);
}

export { FORMULA_VERSION };

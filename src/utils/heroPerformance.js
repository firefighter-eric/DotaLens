import { resolveHeroWinRate } from './metrics.js';

export const compareHeroes = (a, b, sortKey, sortDir, lang) => {
  const factor = sortDir === 'asc' ? 1 : -1;
  const locale = lang === 'en' ? 'en' : 'zh';

  const getValue = (hero) => {
    if (sortKey === 'hero') {
      return hero.hero;
    }
    if (sortKey === 'attribute') {
      return hero.attribute ?? '';
    }
    if (sortKey === 'matches') {
      return hero.matches;
    }
    if (sortKey === 'winRate') {
      return resolveHeroWinRate(hero);
    }
    if (sortKey === 'avgKda') {
      return hero.avgKda;
    }
    if (sortKey === 'avgGpm') {
      return Number.isFinite(hero.avgGpm) ? hero.avgGpm : null;
    }
    if (sortKey === 'avgXpm') {
      return Number.isFinite(hero.avgXpm) ? hero.avgXpm : null;
    }
    return hero.impact;
  };

  const av = getValue(a);
  const bv = getValue(b);
  const aMissing = av == null || (typeof av === 'number' && !Number.isFinite(av));
  const bMissing = bv == null || (typeof bv === 'number' && !Number.isFinite(bv));
  if (aMissing || bMissing) {
    if (aMissing !== bMissing) {
      return aMissing ? 1 : -1;
    }
    return a.hero.localeCompare(b.hero, locale);
  }

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

export const escapeCsvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};


export const getHeroAttributeKey = (hero) => {
  const value = hero.primaryAttr ?? hero.attribute;
  return ({ str: 'str', agi: 'agi', int: 'int', all: 'universal', Strength: 'str', Agility: 'agi', Intelligence: 'int', Universal: 'universal', 力量: 'str', 敏捷: 'agi', 智力: 'int', 全才: 'universal' })[value] ?? 'unknown';
};

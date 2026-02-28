const API_BASE = 'https://api.opendota.com/api';

const requestLocaleConfig = {
  zh: {
    errors: {
      playerNotFound: '未找到该玩家，请检查 ID 是否正确。',
      rateLimit: 'OpenDota 请求过于频繁，请稍后重试。',
      httpFailed: (status) => `OpenDota 请求失败（HTTP ${status}）。`,
    },
  },
  en: {
    errors: {
      playerNotFound: 'Player not found. Please check the ID.',
      rateLimit: 'OpenDota rate limit reached. Please try again later.',
      httpFailed: (status) => `OpenDota request failed (HTTP ${status}).`,
    },
  },
};

let heroesCache = null;

const getRequestLocaleConfig = (lang) => requestLocaleConfig[lang] ?? requestLocaleConfig.zh;

const toPositiveInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(num));
};

const fetchJson = async (path, signal, locale) => {
  const response = await fetch(`${API_BASE}${path}`, { signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(locale.errors.playerNotFound);
    }
    if (response.status === 429) {
      throw new Error(locale.errors.rateLimit);
    }
    throw new Error(locale.errors.httpFailed(response.status));
  }

  return response.json();
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const getHeroesMap = async (signal, locale) => {
  if (heroesCache) {
    return heroesCache;
  }

  const heroes = toArray(await fetchJson('/heroes', signal, locale));
  heroesCache = heroes.reduce((map, hero) => {
    if (hero?.id != null) {
      map.set(hero.id, hero.localized_name);
    }
    return map;
  }, new Map());

  return heroesCache;
};

export const createOpenDotaClient = (lang = 'zh') => {
  const locale = getRequestLocaleConfig(lang);

  return {
    getPlayer: (accountId, signal) => fetchJson(`/players/${accountId}`, signal, locale),
    getPlayerMatchesByDays: async (accountId, days, signal) => {
      const safeDays = toPositiveInt(days, 14);
      const matches = await fetchJson(`/players/${accountId}/matches?date=${safeDays}`, signal, locale);
      return toArray(matches);
    },
    getPlayerLatestMatches: async (accountId, limit, signal) => {
      const safeLimit = toPositiveInt(limit, 1);
      const matches = await fetchJson(`/players/${accountId}/matches?limit=${safeLimit}`, signal, locale);
      return toArray(matches);
    },
    getHeroesMap: (signal) => getHeroesMap(signal, locale),
  };
};

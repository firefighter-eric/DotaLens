import { heroCatalog } from '../data/heroCatalog.js';

const API_BASE = 'https://api.opendota.com/api';
const OPEN_DOTA_SITE = 'https://www.opendota.com';

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

let heroesMetaCache = null;

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

const toAbsoluteUrl = (value) => {
  if (!value) {
    return '';
  }
  return new URL(value, OPEN_DOTA_SITE).toString();
};

const buildPersistedHeroesMetaMap = () =>
  heroCatalog.reduce((map, hero) => {
    map.set(hero.id, {
      name: hero.name,
      avatar: hero.avatar,
      avatarSource: hero.avatarSource,
    });
    return map;
  }, new Map());

const mergeHeroesMeta = (heroes, persistedMap) => {
  const merged = new Map(persistedMap);
  heroes.forEach((hero) => {
    if (hero?.id != null) {
      const existing = merged.get(hero.id);
      merged.set(hero.id, {
        name: hero.localized_name ?? existing?.name ?? `Hero #${hero.id}`,
        avatar: existing?.avatar ?? '',
        avatarSource: existing?.avatarSource ?? toAbsoluteUrl(hero.img),
      });
    }
  });
  return merged;
};

const getHeroesMetaMap = async (signal, locale) => {
  if (heroesMetaCache) {
    return heroesMetaCache;
  }

  const persistedMap = buildPersistedHeroesMetaMap();

  try {
    const heroes = toArray(await fetchJson('/heroes', signal, locale));
    heroesMetaCache = mergeHeroesMeta(heroes, persistedMap);
  } catch {
    heroesMetaCache = persistedMap;
  }

  return heroesMetaCache;
};

export const createOpenDotaClient = (lang = 'zh') => {
  const locale = getRequestLocaleConfig(lang);

  return {
    getPlayer: (accountId, signal) => fetchJson(`/players/${accountId}`, signal, locale),
    getPlayerMatchesByDays: async (accountId, days, signal) => {
      const safeDays = toPositiveInt(days, 14);
      const matches = await fetchJson(`/players/${accountId}/matches?date=${safeDays}&significant=0`, signal, locale);
      return toArray(matches);
    },
    getPlayerLatestMatches: async (accountId, limit, signal) => {
      const safeLimit = toPositiveInt(limit, 1);
      const matches = await fetchJson(`/players/${accountId}/matches?limit=${safeLimit}&significant=0`, signal, locale);
      return toArray(matches);
    },
    getHeroesMetaMap: (signal) => getHeroesMetaMap(signal, locale),
  };
};

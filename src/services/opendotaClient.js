import { heroCatalog } from '../data/heroCatalog.js';

const API_BASE = 'https://api.opendota.com/api';
const OPEN_DOTA_SITE = 'https://www.opendota.com';
const PLAYER_MATCH_PROJECT_FIELDS = [
  'hero_id',
  'kills',
  'deaths',
  'assists',
  'lane_role',
  'is_roaming',
  'average_rank',
  'average_rank_tier',
  'rank_tier',
  'skill',
  'gold_per_min',
  'xp_per_min',
];

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

const heroesMetaCacheByLang = new Map();

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

const pickNameByLang = (nameEn, nameZh, lang) => {
  if (lang === 'en') {
    return nameEn || nameZh || '';
  }
  return nameZh || nameEn || '';
};

const buildPersistedHeroesMetaMap = (lang) =>
  heroCatalog.reduce((map, hero) => {
    const nameEn = hero.nameEn ?? hero.name ?? '';
    const nameZh = hero.nameZh ?? nameEn;
    map.set(hero.id, {
      nameEn,
      nameZh,
      name: pickNameByLang(nameEn, nameZh, lang),
      avatar: hero.avatar,
      avatarSource: hero.avatarSource,
    });
    return map;
  }, new Map());

const mergeHeroesMeta = (heroes, persistedMap, lang) => {
  const merged = new Map(persistedMap);
  heroes.forEach((hero) => {
    if (hero?.id != null) {
      const existing = merged.get(hero.id);
      const nameEn = hero.localized_name ?? existing?.nameEn ?? `Hero #${hero.id}`;
      const nameZh = existing?.nameZh ?? nameEn;
      merged.set(hero.id, {
        nameEn,
        nameZh,
        name: pickNameByLang(nameEn, nameZh, lang),
        avatar: existing?.avatar ?? '',
        avatarSource: existing?.avatarSource ?? toAbsoluteUrl(hero.img),
      });
    }
  });
  return merged;
};

const getHeroesMetaMap = async (signal, locale, lang) => {
  const cacheKey = lang === 'en' ? 'en' : 'zh';
  const cached = heroesMetaCacheByLang.get(cacheKey);
  if (cached) {
    return cached;
  }

  const persistedMap = buildPersistedHeroesMetaMap(cacheKey);

  try {
    const heroes = toArray(await fetchJson('/heroes', signal, locale));
    const merged = mergeHeroesMeta(heroes, persistedMap, cacheKey);
    heroesMetaCacheByLang.set(cacheKey, merged);
  } catch {
    heroesMetaCacheByLang.set(cacheKey, persistedMap);
  }

  return heroesMetaCacheByLang.get(cacheKey);
};

export const createOpenDotaClient = (lang = 'zh') => {
  const locale = getRequestLocaleConfig(lang);

  return {
    getPlayer: (accountId, signal) => fetchJson(`/players/${accountId}`, signal, locale),
    getPlayerMatchesByDays: async (accountId, days, signal) => {
      const safeDays = toPositiveInt(days, 14);
      const projectQuery = PLAYER_MATCH_PROJECT_FIELDS.map((field) => `project=${field}`).join('&');
      try {
        const matches = await fetchJson(`/players/${accountId}/matches?date=${safeDays}&significant=0&${projectQuery}`, signal, locale);
        return toArray(matches);
      } catch {
        const matches = await fetchJson(`/players/${accountId}/matches?date=${safeDays}&significant=0`, signal, locale);
        return toArray(matches);
      }
    },
    getPlayerLatestMatches: async (accountId, limit, signal) => {
      const safeLimit = toPositiveInt(limit, 1);
      try {
        const matches = await fetchJson(`/players/${accountId}/recentMatches`, signal, locale);
        return toArray(matches).slice(0, safeLimit);
      } catch {
        const matches = await fetchJson(`/players/${accountId}/matches?limit=${safeLimit}&significant=0`, signal, locale);
        return toArray(matches);
      }
    },
    getHeroesMetaMap: (signal) => getHeroesMetaMap(signal, locale, lang),
  };
};

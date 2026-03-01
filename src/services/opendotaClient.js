import { heroCatalog } from '../data/heroCatalog.js';
import { itemCatalog } from '../data/itemCatalog.js';

const API_BASE = 'https://api.opendota.com/api';
const PLAYER_MATCH_PROJECT_FIELDS = [
  'match_id',
  'start_time',
  'duration',
  'player_slot',
  'hero_id',
  'kills',
  'deaths',
  'assists',
  'hero_damage',
  'multi_kills',
  'kill_streaks',
  'max_kill_streak',
  'rampages',
  'lane_role',
  'is_roaming',
  'average_rank',
  'average_rank_tier',
  'rank_tier',
  'skill',
  'gold_per_min',
  'xp_per_min',
];
const PLAYER_MATCH_PAGE_LIMIT = 500;
const PLAYER_MATCH_MAX_PAGES = 40;

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
const itemMetaCacheByLang = new Map();
let abilityNameByIdCache = null;

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
const dedupeMatchesById = (matches) => {
  const byId = new Map();
  toArray(matches).forEach((match) => {
    const matchId = Number(match?.match_id);
    if (Number.isFinite(matchId) && matchId > 0) {
      if (!byId.has(matchId)) {
        byId.set(matchId, match);
      }
      return;
    }
    byId.set(`row-${byId.size}`, match);
  });
  return Array.from(byId.values());
};
const toFiniteOrNull = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickNameByLang = (nameEn, nameZh, lang) => {
  if (lang === 'en') {
    return nameEn || nameZh || '';
  }
  return nameZh || nameEn || '';
};

const normalizePrimaryAttr = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'str' || normalized === 'agi' || normalized === 'int' || normalized === 'all') {
    return normalized;
  }
  if (normalized === 'universal') {
    return 'all';
  }
  return '';
};

const normalizeHeroRoles = (value) =>
  toArray(value)
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);

const createHeroDetailFromSource = (source = {}) => ({
  primaryAttr: normalizePrimaryAttr(source.primaryAttr ?? source.primary_attr),
  attackType: String(source.attackType ?? source.attack_type ?? '').trim(),
  roles: normalizeHeroRoles(source.roles),
  baseStr: toFiniteOrNull(source.baseStr ?? source.base_str),
  strGain: toFiniteOrNull(source.strGain ?? source.str_gain),
  baseAgi: toFiniteOrNull(source.baseAgi ?? source.base_agi),
  agiGain: toFiniteOrNull(source.agiGain ?? source.agi_gain),
  baseInt: toFiniteOrNull(source.baseInt ?? source.base_int),
  intGain: toFiniteOrNull(source.intGain ?? source.int_gain),
  attackRange: toFiniteOrNull(source.attackRange ?? source.attack_range),
  moveSpeed: toFiniteOrNull(source.moveSpeed ?? source.move_speed),
});

const buildPersistedHeroesMetaMap = (lang) =>
  heroCatalog.reduce((map, hero) => {
    const nameEn = hero.nameEn ?? hero.name ?? '';
    const nameZh = hero.nameZh ?? nameEn;
    const detail = createHeroDetailFromSource(hero);
    map.set(hero.id, {
      nameEn,
      nameZh,
      name: pickNameByLang(nameEn, nameZh, lang),
      avatar: hero.avatar,
      avatarSource: hero.avatarSource,
      ...detail,
    });
    return map;
  }, new Map());

const buildPersistedItemMeta = (lang) => {
  const nameById = new Map();
  const nameByKey = new Map();
  const itemById = new Map();
  const itemByKey = new Map();

  itemCatalog.forEach((item) => {
    const token = String(item?.key ?? '');
    if (!token) {
      return;
    }

    const nameEn = item?.nameEn ?? item?.name ?? '';
    const nameZh = item?.nameZh ?? nameEn;
    const entry = {
      nameEn,
      nameZh,
      name: pickNameByLang(nameEn, nameZh, lang),
      icon: item?.icon ?? '',
      iconSource: item?.iconSource ?? '',
    };

    nameByKey.set(token, entry.name);
    itemByKey.set(token, entry);

    const id = Number(item?.id);
    if (Number.isFinite(id) && id > 0) {
      nameById.set(id, entry.name);
      itemById.set(id, entry);
    }
  });

  return {
    nameById,
    nameByKey,
    itemById,
    itemByKey,
  };
};

const getHeroesMetaMap = async (_signal, _locale, lang) => {
  const cacheKey = lang === 'en' ? 'en' : 'zh';
  const cached = heroesMetaCacheByLang.get(cacheKey);
  if (cached) {
    return cached;
  }

  const persistedMap = buildPersistedHeroesMetaMap(cacheKey);
  heroesMetaCacheByLang.set(cacheKey, persistedMap);
  return persistedMap;
};

const getItemMeta = async (_signal, _locale, lang) => {
  const cacheKey = lang === 'en' ? 'en' : 'zh';
  const cached = itemMetaCacheByLang.get(cacheKey);
  if (cached) {
    return cached;
  }

  const persistedMeta = buildPersistedItemMeta(cacheKey);
  itemMetaCacheByLang.set(cacheKey, persistedMeta);
  return persistedMeta;
};

const getAbilityNameById = async () => {
  if (abilityNameByIdCache) {
    return abilityNameByIdCache;
  }

  abilityNameByIdCache = new Map();
  return abilityNameByIdCache;
};

export const createOpenDotaClient = (lang = 'zh') => {
  const locale = getRequestLocaleConfig(lang);

  return {
    getPlayer: (accountId, signal) => fetchJson(`/players/${accountId}`, signal, locale),
    getMatchById: (matchId, signal) => fetchJson(`/matches/${matchId}`, signal, locale),
    getPlayerCountsByDays: (accountId, days, signal) => {
      const safeDays = toPositiveInt(days, 14);
      return fetchJson(`/players/${accountId}/counts?date=${safeDays}&significant=0`, signal, locale);
    },
    getPlayerMatchesByDays: async (accountId, days, signal) => {
      const safeDays = toPositiveInt(days, 14);
      const projectQuery = PLAYER_MATCH_PROJECT_FIELDS.map((field) => `project=${field}`).join('&');
      const fetchWindowMatches = async (withProjectFields) => {
        const all = [];
        for (let page = 0; page < PLAYER_MATCH_MAX_PAGES; page += 1) {
          const offset = page * PLAYER_MATCH_PAGE_LIMIT;
          const baseQuery = `date=${safeDays}&significant=0&limit=${PLAYER_MATCH_PAGE_LIMIT}&offset=${offset}`;
          const query = withProjectFields ? `${baseQuery}&${projectQuery}` : baseQuery;
          const pageMatches = toArray(await fetchJson(`/players/${accountId}/matches?${query}`, signal, locale));
          if (pageMatches.length === 0) {
            break;
          }
          all.push(...pageMatches);
          if (pageMatches.length < PLAYER_MATCH_PAGE_LIMIT) {
            break;
          }
        }
        return dedupeMatchesById(all);
      };

      try {
        return await fetchWindowMatches(true);
      } catch {
        return fetchWindowMatches(false);
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
    getItemMeta: (signal) => getItemMeta(signal, locale, lang),
    getAbilityNameById: () => getAbilityNameById(),
  };
};

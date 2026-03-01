import { heroCatalog } from '../data/heroCatalog.js';
import { itemCatalog } from '../data/itemCatalog.js';

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
const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const toAbsoluteUrl = (value) => {
  if (!value) {
    return '';
  }
  return new URL(value, OPEN_DOTA_SITE).toString();
};

const prettifyToken = (value) =>
  String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveNamedEntry = (value, fallbackToken) => {
  const objectValue = toObject(value);
  return objectValue.dname || objectValue.localized_name || objectValue.name || prettifyToken(fallbackToken);
};

const buildIdToTokenMap = (payload) => {
  const source = toObject(payload);
  const map = new Map();

  Object.entries(source).forEach(([key, value]) => {
    const idFromKey = Number.parseInt(key, 10);
    if (Number.isFinite(idFromKey) && idFromKey > 0) {
      map.set(idFromKey, String(value));
      return;
    }

    const idFromValue = Number.parseInt(String(value), 10);
    if (Number.isFinite(idFromValue) && idFromValue > 0) {
      map.set(idFromValue, String(key));
    }
  });

  return map;
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

const mergeItemMeta = (idToToken, itemDefs, persistedMeta, lang) => {
  const nameById = new Map(persistedMeta.nameById);
  const nameByKey = new Map(persistedMeta.nameByKey);
  const itemById = new Map(persistedMeta.itemById);
  const itemByKey = new Map(persistedMeta.itemByKey);

  Object.entries(itemDefs).forEach(([token, detail]) => {
    const objectDetail = toObject(detail);
    const existing = itemByKey.get(token);
    const nameEn = resolveNamedEntry(objectDetail, token) || existing?.nameEn || prettifyToken(token);
    const nameZh = existing?.nameZh ?? nameEn;
    const iconSource = objectDetail.img ? toAbsoluteUrl(objectDetail.img) : '';
    const nextEntry = {
      nameEn,
      nameZh,
      name: pickNameByLang(nameEn, nameZh, lang),
      icon: existing?.icon || iconSource,
      iconSource: existing?.iconSource || iconSource,
    };
    nameByKey.set(token, nextEntry.name);
    itemByKey.set(token, nextEntry);
  });

  idToToken.forEach((token, id) => {
    const fromToken = itemByKey.get(token);
    const existing = itemById.get(id);
    const fallbackNameEn = existing?.nameEn ?? prettifyToken(token);
    const fallbackNameZh = existing?.nameZh ?? fallbackNameEn;
    const nextEntry = fromToken ?? {
      nameEn: fallbackNameEn,
      nameZh: fallbackNameZh,
      name: pickNameByLang(fallbackNameEn, fallbackNameZh, lang),
      icon: existing?.icon ?? '',
      iconSource: existing?.iconSource ?? '',
    };
    nameById.set(id, nextEntry.name);
    itemById.set(id, nextEntry);
  });

  return {
    nameById,
    nameByKey,
    itemById,
    itemByKey,
  };
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

const getItemMeta = async (signal, locale, lang) => {
  const cacheKey = lang === 'en' ? 'en' : 'zh';
  const cached = itemMetaCacheByLang.get(cacheKey);
  if (cached) {
    return cached;
  }

  const persistedMeta = buildPersistedItemMeta(cacheKey);

  try {
    const [itemIdsPayload, itemsPayload] = await Promise.all([
      fetchJson('/constants/item_ids', signal, locale),
      fetchJson('/constants/items', signal, locale),
    ]);

    const idToToken = buildIdToTokenMap(itemIdsPayload);
    const itemDefs = toObject(itemsPayload);
    const merged = mergeItemMeta(idToToken, itemDefs, persistedMeta, cacheKey);
    itemMetaCacheByLang.set(cacheKey, merged);
  } catch {
    itemMetaCacheByLang.set(cacheKey, persistedMeta);
  }

  return itemMetaCacheByLang.get(cacheKey);
};

const getAbilityNameById = async (signal, locale) => {
  if (abilityNameByIdCache) {
    return abilityNameByIdCache;
  }

  const fallback = new Map();

  try {
    const [abilityIdsPayload, abilitiesPayload] = await Promise.all([
      fetchJson('/constants/ability_ids', signal, locale),
      fetchJson('/constants/abilities', signal, locale),
    ]);

    const idToToken = buildIdToTokenMap(abilityIdsPayload);
    const abilityDefs = toObject(abilitiesPayload);
    const map = new Map();

    idToToken.forEach((token, id) => {
      const detail = abilityDefs[token];
      map.set(id, resolveNamedEntry(detail, token));
    });

    abilityNameByIdCache = map;
  } catch {
    abilityNameByIdCache = fallback;
  }

  return abilityNameByIdCache;
};

export const createOpenDotaClient = (lang = 'zh') => {
  const locale = getRequestLocaleConfig(lang);

  return {
    getPlayer: (accountId, signal) => fetchJson(`/players/${accountId}`, signal, locale),
    getMatchById: (matchId, signal) => fetchJson(`/matches/${matchId}`, signal, locale),
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
    getItemMeta: (signal) => getItemMeta(signal, locale, lang),
    getAbilityNameById: (signal) => getAbilityNameById(signal, locale),
  };
};

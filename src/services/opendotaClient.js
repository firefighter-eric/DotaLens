import { heroCatalog } from '../data/heroCatalog.js';
import {
  DEFAULT_OPENDOTA_API_BASE,
  normalizeOpenDotaApiBase,
} from '../config/openDotaApiBase.js';

const API_BASE = normalizeOpenDotaApiBase(
  import.meta.env?.VITE_OPENDOTA_API_BASE || DEFAULT_OPENDOTA_API_BASE
);
const PLAYER_MATCH_PROJECT_FIELDS = [
  'match_id',
  'start_time',
  'duration',
  'game_mode',
  'lobby_type',
  'player_slot',
  'radiant_win',
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
const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = {
  player: 5 * 60 * 1000,
  playerMatches: 60 * 1000,
  latestMatches: 30 * 1000,
  peers: 5 * 60 * 1000,
  match: 5 * 60 * 1000,
  abilities: 24 * 60 * 60 * 1000,
};
const CACHE_MAX_ENTRIES = {
  player: 20,
  playerMatches: 20,
  latestMatches: 20,
  peers: 20,
  match: 50,
  abilities: 2,
};
const CACHE_MISS = Symbol('cache-miss');

const requestLocaleConfig = {
  zh: {
    errors: {
      playerNotFound: '未找到该玩家，请检查 ID 是否正确。',
      matchNotFound: '未找到该场比赛，比赛可能尚未同步或已不可用。',
      resourceNotFound: 'OpenDota 资源不存在或当前不可用。',
      rateLimit: 'OpenDota 请求过于频繁，请稍后重试。',
      invalidRequest: 'OpenDota 拒绝了当前请求参数。',
      network: '无法连接 OpenDota，请检查网络后重试。',
      timeout: 'OpenDota 响应超时，请重试或切换玩家。',
      invalidResponse: 'OpenDota 返回了无法解析的数据。',
      httpFailed: (status) => `OpenDota 请求失败（HTTP ${status}）。`,
    },
  },
  en: {
    errors: {
      playerNotFound: 'Player not found. Please check the ID.',
      matchNotFound: 'Match not found. It may not be synchronized or available yet.',
      resourceNotFound: 'The requested OpenDota resource was not found or is unavailable.',
      rateLimit: 'OpenDota rate limit reached. Please try again later.',
      invalidRequest: 'OpenDota rejected the request parameters.',
      network: 'Unable to reach OpenDota. Please check your connection and try again.',
      timeout: 'OpenDota timed out. Please retry or switch players.',
      invalidResponse: 'OpenDota returned an invalid response.',
      httpFailed: (status) => `OpenDota request failed (HTTP ${status}).`,
    },
  },
};

const heroesMetaCacheByLang = new Map();
const itemMetaCacheByLang = new Map();
const responseCaches = {
  player: new Map(),
  playerMatches: new Map(),
  latestMatches: new Map(),
  peers: new Map(),
  match: new Map(),
  abilities: new Map(),
};
const inflightRequests = {
  player: new Map(),
  playerMatches: new Map(),
  latestMatches: new Map(),
  peers: new Map(),
  match: new Map(),
  abilities: new Map(),
};

const getRequestLocaleConfig = (lang) => requestLocaleConfig[lang] ?? requestLocaleConfig.zh;

const toPositiveInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(num));
};

const createAbortError = () => {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
};

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw signal.reason?.name === 'AbortError' ? signal.reason : createAbortError();
  }
};

export class OpenDotaError extends Error {
  constructor(
    message,
    {
      code = 'OPEN_DOTA_ERROR',
      status = null,
      resource = 'request',
      retryable = false,
      retryAfter = null,
      cause,
    } = {}
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'OpenDotaError';
    this.code = code;
    this.status = status;
    this.resource = resource;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

const parseRetryAfterSeconds = (response) => {
  const value = response.headers?.get?.('retry-after');
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) {
    return null;
  }
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
};

const resolveHttpError = (response, locale, resource) => {
  if (response.status === 404) {
    const isMatchResource = resource === 'match';
    const isPlayerResource =
      resource === 'player' ||
      resource === 'playerPeers' ||
      resource === 'playerMatches' ||
      resource === 'playerCounts' ||
      resource === 'recentMatches';
    const message = isMatchResource
      ? locale.errors.matchNotFound
      : isPlayerResource
        ? locale.errors.playerNotFound
        : locale.errors.resourceNotFound;
    return new OpenDotaError(message, {
      code: isMatchResource
        ? 'MATCH_NOT_FOUND'
        : isPlayerResource
          ? 'PLAYER_NOT_FOUND'
          : 'RESOURCE_NOT_FOUND',
      status: response.status,
      resource,
    });
  }
  if (response.status === 429) {
    return new OpenDotaError(locale.errors.rateLimit, {
      code: 'RATE_LIMITED',
      status: response.status,
      resource,
      retryable: true,
      retryAfter: parseRetryAfterSeconds(response),
    });
  }
  if (response.status === 400 || response.status === 422) {
    return new OpenDotaError(locale.errors.invalidRequest, {
      code: 'INVALID_REQUEST',
      status: response.status,
      resource,
    });
  }
  return new OpenDotaError(locale.errors.httpFailed(response.status), {
    code: 'HTTP_ERROR',
    status: response.status,
    resource,
    retryable: response.status >= 500,
  });
};

const localizeOpenDotaError = (error, locale) => {
  if (!(error instanceof OpenDotaError)) {
    return error;
  }

  const messageByCode = {
    PLAYER_NOT_FOUND: locale.errors.playerNotFound,
    MATCH_NOT_FOUND: locale.errors.matchNotFound,
    RESOURCE_NOT_FOUND: locale.errors.resourceNotFound,
    RATE_LIMITED: locale.errors.rateLimit,
    INVALID_REQUEST: locale.errors.invalidRequest,
    NETWORK_ERROR: locale.errors.network,
    TIMEOUT: locale.errors.timeout,
    INVALID_RESPONSE: locale.errors.invalidResponse,
    HTTP_ERROR: locale.errors.httpFailed(error.status),
  };
  return new OpenDotaError(messageByCode[error.code] ?? error.message, {
    code: error.code,
    status: error.status,
    resource: error.resource,
    retryable: error.retryable,
    retryAfter: error.retryAfter,
    cause: error.cause,
  });
};

const fetchJson = async (path, signal, locale, resource = 'request') => {
  throwIfAborted(signal);
  const requestController = new AbortController();
  let timedOut = false;
  let response;
  const handleCallerAbort = () => {
    requestController.abort(
      signal?.reason?.name === 'AbortError' ? signal.reason : createAbortError()
    );
  };
  signal?.addEventListener('abort', handleCallerAbort, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort(createAbortError());
  }, REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal: requestController.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw resolveHttpError(response, locale, resource);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof OpenDotaError) {
      throw error;
    }
    if (timedOut) {
      throw new OpenDotaError(locale.errors.timeout, {
        code: 'TIMEOUT',
        resource,
        retryable: true,
        cause: error,
      });
    }
    if (signal?.aborted) {
      throw signal.reason?.name === 'AbortError' ? signal.reason : createAbortError();
    }
    if (error?.name === 'AbortError') {
      throw error;
    }
    const isResponseParseFailure = Boolean(response?.ok);
    throw new OpenDotaError(
      isResponseParseFailure ? locale.errors.invalidResponse : locale.errors.network,
      {
        code: isResponseParseFailure ? 'INVALID_RESPONSE' : 'NETWORK_ERROR',
        status: response?.status ?? null,
        resource,
        retryable: !isResponseParseFailure,
        cause: error,
      }
    );
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleCallerAbort);
  }
};

const readCache = (cache, key) => {
  const entry = cache.get(key);
  if (!entry) {
    return CACHE_MISS;
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return CACHE_MISS;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
};

const writeCache = (cache, key, value, ttlMs, maxEntries) => {
  const now = Date.now();
  for (const [cachedKey, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(cachedKey);
    }
  }
  cache.delete(key);
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

const waitForSharedRequest = (entry, signal, locale) => {
  throwIfAborted(signal);
  entry.subscribers += 1;

  return new Promise((resolve, reject) => {
    let settled = false;
    const release = () => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      entry.subscribers = Math.max(0, entry.subscribers - 1);
      if (entry.subscribers === 0 && !entry.completed) {
        queueMicrotask(() => {
          if (entry.subscribers === 0 && !entry.completed) {
            entry.controller.abort();
          }
        });
      }
    };
    const onAbort = () => {
      release();
      reject(signal?.reason?.name === 'AbortError' ? signal.reason : createAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(
      (value) => {
        release();
        resolve(value);
      },
      (error) => {
        release();
        reject(locale ? localizeOpenDotaError(error, locale) : error);
      }
    );
  });
};

const getCachedResource = async ({ cacheName, key, ttlMs, signal, locale, load }) => {
  throwIfAborted(signal);
  const cache = responseCaches[cacheName];
  const cached = readCache(cache, key);
  if (cached !== CACHE_MISS) {
    return cached;
  }

  const inflight = inflightRequests[cacheName];
  let entry = inflight.get(key);
  if (entry && (entry.completed || entry.controller.signal.aborted)) {
    if (inflight.get(key) === entry) {
      inflight.delete(key);
    }
    entry = null;
  }
  if (!entry) {
    const controller = new AbortController();
    entry = {
      controller,
      subscribers: 0,
      completed: false,
      promise: null,
    };
    entry.promise = Promise.resolve()
      .then(() => load(controller.signal))
      .then((value) => {
        if (!controller.signal.aborted && inflight.get(key) === entry) {
          writeCache(
            cache,
            key,
            value,
            ttlMs,
            CACHE_MAX_ENTRIES[cacheName] ?? 20
          );
        }
        return value;
      })
      .finally(() => {
        entry.completed = true;
        if (inflight.get(key) === entry) {
          inflight.delete(key);
        }
      });
    inflight.set(key, entry);
  }

  return waitForSharedRequest(entry, signal, locale);
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
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
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

const buildPersistedItemMeta = (catalog, lang) => {
  const nameById = new Map();
  const nameByKey = new Map();
  const itemById = new Map();
  const itemByKey = new Map();

  catalog.forEach((item) => {
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

  const { itemCatalog } = await import('../data/itemCatalog.js');
  const persistedMeta = buildPersistedItemMeta(itemCatalog, cacheKey);
  itemMetaCacheByLang.set(cacheKey, persistedMeta);
  return persistedMeta;
};

const prettifyAbilityToken = (value) =>
  String(value ?? '')
    .replace(/^npc_dota_/, '')
    .replace(/^ability_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const buildAbilityNameById = (payload) => {
  const nameById = new Map();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return nameById;
  }

  Object.entries(payload).forEach(([rawKey, rawValue]) => {
    const keyAsId = Number.parseInt(rawKey, 10);
    if (Number.isFinite(keyAsId) && keyAsId > 0) {
      const token =
        typeof rawValue === 'string'
          ? rawValue
          : rawValue?.dname ?? rawValue?.name ?? rawValue?.localized_name ?? rawValue?.key;
      const name = prettifyAbilityToken(token);
      if (name) {
        nameById.set(keyAsId, name);
      }
      return;
    }

    const valueAsId =
      typeof rawValue === 'number' || typeof rawValue === 'string'
        ? Number.parseInt(String(rawValue), 10)
        : Number.parseInt(String(rawValue?.id ?? ''), 10);
    if (!Number.isFinite(valueAsId) || valueAsId <= 0) {
      return;
    }
    const displayName =
      typeof rawValue === 'object'
        ? rawValue?.dname ?? rawValue?.localized_name ?? rawValue?.name ?? rawKey
        : rawKey;
    const name = prettifyAbilityToken(displayName);
    if (name) {
      nameById.set(valueAsId, name);
    }
  });

  return nameById;
};

const getAbilityNameById = (signal, locale) =>
  getCachedResource({
    cacheName: 'abilities',
    key: 'ability_ids',
    ttlMs: CACHE_TTL_MS.abilities,
    signal,
    locale,
    load: async (requestSignal) => {
      const payload = await fetchJson('/constants/ability_ids', requestSignal, locale, 'abilities');
      const nameById = buildAbilityNameById(payload);
      if (nameById.size === 0) {
        return {
          nameById,
          available: false,
          source: 'fallback',
          issue: {
            code: 'ABILITY_NAMES_UNAVAILABLE',
            resource: 'abilities',
            retryable: false,
          },
        };
      }
      return {
        nameById,
        available: true,
        source: 'opendota_constants',
        issue: null,
      };
    },
  });

const isProjectionUnsupportedError = (error) =>
  error instanceof OpenDotaError && error.code === 'INVALID_REQUEST' && (error.status === 400 || error.status === 422);

const deleteKeysMatching = (map, predicate) => {
  for (const key of map.keys()) {
    if (predicate(key)) {
      map.delete(key);
    }
  }
};

const abortInflightKeysMatching = (map, predicate) => {
  for (const [key, entry] of map.entries()) {
    if (predicate(key)) {
      entry.controller.abort();
      map.delete(key);
    }
  }
};

export const invalidateOpenDotaCache = ({ accountId, days, matchId } = {}) => {
  const hasSelector = accountId != null || days != null || matchId != null;
  if (!hasSelector) {
    Object.values(responseCaches).forEach((cache) => cache.clear());
    Object.values(inflightRequests).forEach((requests) => {
      requests.forEach((entry) => entry.controller.abort());
      requests.clear();
    });
    return;
  }

  if (accountId != null) {
    const accountKey = String(accountId);
    const accountPrefix = `${accountKey}:`;
    const matchesKey = days == null ? null : `${accountKey}:${toPositiveInt(days, 14)}`;
    const matchesSelector = (key) => (matchesKey ? key === matchesKey : key.startsWith(accountPrefix));
    responseCaches.player.delete(accountKey);
    inflightRequests.player.get(accountKey)?.controller.abort();
    inflightRequests.player.delete(accountKey);
    deleteKeysMatching(responseCaches.playerMatches, matchesSelector);
    abortInflightKeysMatching(inflightRequests.playerMatches, matchesSelector);
    deleteKeysMatching(responseCaches.latestMatches, (key) => key.startsWith(accountPrefix));
    abortInflightKeysMatching(inflightRequests.latestMatches, (key) => key.startsWith(accountPrefix));
    responseCaches.peers.delete(accountKey);
    inflightRequests.peers.get(accountKey)?.controller.abort();
    inflightRequests.peers.delete(accountKey);
  }
  if (matchId != null) {
    const matchKey = String(matchId);
    responseCaches.match.delete(matchKey);
    inflightRequests.match.get(matchKey)?.controller.abort();
    inflightRequests.match.delete(matchKey);
  }
};

export const createOpenDotaClient = (lang = 'zh') => {
  const locale = getRequestLocaleConfig(lang);

  return {
    getPlayer: (accountId, signal) => {
      const key = String(accountId);
      return getCachedResource({
        cacheName: 'player',
        key,
        ttlMs: CACHE_TTL_MS.player,
        signal,
        locale,
        load: (requestSignal) =>
          fetchJson(`/players/${encodeURIComponent(key)}`, requestSignal, locale, 'player'),
      });
    },
    getPlayerPeers: (accountId, signal) => {
      const key = String(accountId);
      return getCachedResource({
        cacheName: 'peers',
        key,
        ttlMs: CACHE_TTL_MS.peers,
        signal,
        locale,
        load: (requestSignal) =>
          fetchJson(`/players/${encodeURIComponent(key)}/peers`, requestSignal, locale, 'playerPeers'),
      });
    },
    getMatchById: (matchId, signal) => {
      const key = String(matchId);
      return getCachedResource({
        cacheName: 'match',
        key,
        ttlMs: CACHE_TTL_MS.match,
        signal,
        locale,
        load: (requestSignal) =>
          fetchJson(`/matches/${encodeURIComponent(key)}`, requestSignal, locale, 'match'),
      });
    },
    getPlayerMatchesByDays: (accountId, days, signal) => {
      const safeDays = toPositiveInt(days, 14);
      const accountKey = String(accountId);
      const key = `${accountKey}:${safeDays}`;
      return getCachedResource({
        cacheName: 'playerMatches',
        key,
        ttlMs: CACHE_TTL_MS.playerMatches,
        signal,
        locale,
        load: async (requestSignal) => {
          const projectQuery = PLAYER_MATCH_PROJECT_FIELDS.map((field) => `project=${encodeURIComponent(field)}`).join('&');
          const fetchWindowMatches = async (withProjectFields) => {
            const all = [];
            let pageCount = 0;
            let truncated = false;
            for (let page = 0; page < PLAYER_MATCH_MAX_PAGES; page += 1) {
              const offset = page * PLAYER_MATCH_PAGE_LIMIT;
              const baseQuery = `date=${safeDays}&significant=0&limit=${PLAYER_MATCH_PAGE_LIMIT}&offset=${offset}`;
              const query = withProjectFields ? `${baseQuery}&${projectQuery}` : baseQuery;
              const pageMatches = toArray(
                await fetchJson(
                  `/players/${encodeURIComponent(accountKey)}/matches?${query}`,
                  requestSignal,
                  locale,
                  'playerMatches'
                )
              );
              pageCount += 1;
              if (pageMatches.length === 0) {
                break;
              }
              all.push(...pageMatches);
              if (pageMatches.length < PLAYER_MATCH_PAGE_LIMIT) {
                break;
              }
              if (page === PLAYER_MATCH_MAX_PAGES - 1) {
                truncated = true;
              }
            }
            return {
              matches: dedupeMatchesById(all),
              requestedDays: safeDays,
              pageCount,
              pageLimit: PLAYER_MATCH_PAGE_LIMIT,
              maxPages: PLAYER_MATCH_MAX_PAGES,
              truncated,
              projectionFallback: !withProjectFields,
            };
          };

          try {
            return await fetchWindowMatches(true);
          } catch (error) {
            if (!isProjectionUnsupportedError(error)) {
              throw error;
            }
            return fetchWindowMatches(false);
          }
        },
      });
    },
    getPlayerLatestMatches: (accountId, limit, signal) => {
      const safeLimit = toPositiveInt(limit, 1);
      const accountKey = String(accountId);
      const key = `${accountKey}:${safeLimit}`;
      return getCachedResource({
        cacheName: 'latestMatches',
        key,
        ttlMs: CACHE_TTL_MS.latestMatches,
        signal,
        locale,
        load: async (requestSignal) => {
          const matches = await fetchJson(
            `/players/${encodeURIComponent(accountKey)}/recentMatches`,
            requestSignal,
            locale,
            'recentMatches'
          );
          return toArray(matches).slice(0, safeLimit);
        },
      });
    },
    getHeroesMetaMap: (signal) => getHeroesMetaMap(signal, locale, lang),
    getItemMeta: (signal) => getItemMeta(signal, locale, lang),
    getAbilityNameById: (signal) => getAbilityNameById(signal, locale),
  };
};

export const openDotaClientTesting = Object.freeze({
  buildAbilityNameById,
  cacheMaxEntries: CACHE_MAX_ENTRIES,
  getCacheKeys: (cacheName) => Array.from(responseCaches[cacheName]?.keys() ?? []),
  isProjectionUnsupportedError,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
});

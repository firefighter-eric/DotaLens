import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOpenDotaClient,
  invalidateOpenDotaCache,
  OpenDotaError,
  openDotaClientTesting,
} from './opendotaClient.js';

const originalFetch = globalThis.fetch;
const response = (payload, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (name) => headers[String(name).toLowerCase()] ?? null,
  },
  json: async () => payload,
});

afterEach(() => {
  invalidateOpenDotaCache();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('OpenDota client contracts', () => {
  it('coalesces callers and reuses raw responses across languages', async () => {
    globalThis.fetch = vi.fn(async () =>
      response({
        profile: {
          personaname: 'Player',
        },
      })
    );
    const zhClient = createOpenDotaClient('zh');
    const enClient = createOpenDotaClient('en');

    const [zhPlayer, enPlayer] = await Promise.all([
      zhClient.getPlayer(42),
      enClient.getPlayer(42),
    ]);
    const cachedPlayer = await enClient.getPlayer(42);

    expect(zhPlayer).toBe(enPlayer);
    expect(cachedPlayer).toBe(zhPlayer);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('bounds the large match cache and evicts the least-recently-used entry', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const matchId = Number(String(url).split('/').pop());
      return response({ match_id: matchId, players: [] });
    });
    const client = createOpenDotaClient('en');
    const limit = openDotaClientTesting.cacheMaxEntries.match;

    for (let matchId = 1; matchId <= limit + 1; matchId += 1) {
      await client.getMatchById(matchId);
    }

    const keys = openDotaClientTesting.getCacheKeys('match');
    expect(keys).toHaveLength(limit);
    expect(keys).not.toContain('1');
    expect(keys).toContain(String(limit + 1));

    await client.getMatchById(limit + 1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(limit + 1);
    await client.getMatchById(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(limit + 2);
  });

  it('starts a new request instead of joining an aborted in-flight entry', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (_url, options = {}) => {
      calls += 1;
      if (calls > 1) {
        return response({ profile: { personaname: 'Recovered' } });
      }

      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => {
            setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 25);
          },
          { once: true }
        );
      });
    });

    const client = createOpenDotaClient('en');
    const firstController = new AbortController();
    const first = client.getPlayer(42, firstController.signal);
    firstController.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();

    await expect(client.getPlayer(42)).resolves.toMatchObject({
      profile: { personaname: 'Recovered' },
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not let a late aborted request overwrite a fresh cache value', async () => {
    const responseResolvers = [];
    globalThis.fetch = vi.fn(
      async () =>
        new Promise((resolve) => {
          responseResolvers.push(resolve);
        })
    );

    const client = createOpenDotaClient('en');
    const firstController = new AbortController();
    const first = client.getPlayer(42, firstController.signal);
    await Promise.resolve();
    firstController.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();

    const second = client.getPlayer(42);
    await Promise.resolve();
    responseResolvers[1](response({ profile: { personaname: 'Fresh' } }));
    await expect(second).resolves.toMatchObject({
      profile: { personaname: 'Fresh' },
    });

    responseResolvers[0](response({ profile: { personaname: 'Stale' } }));
    await Promise.resolve();
    await Promise.resolve();

    await expect(client.getPlayer(42)).resolves.toMatchObject({
      profile: { personaname: 'Fresh' },
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('classifies 404s by resource', async () => {
    globalThis.fetch = vi.fn(async () => response({}, 404));

    await expect(createOpenDotaClient('en').getMatchById(123)).rejects.toMatchObject({
      name: 'OpenDotaError',
      code: 'MATCH_NOT_FOUND',
      status: 404,
      resource: 'match',
      retryable: false,
    });
  });

  it('localizes a coalesced failure for each caller language', async () => {
    globalThis.fetch = vi.fn(async () => response({}, 404));
    const [zhResult, enResult] = await Promise.allSettled([
      createOpenDotaClient('zh').getPlayer(42),
      createOpenDotaClient('en').getPlayer(42),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(zhResult).toMatchObject({
      status: 'rejected',
      reason: {
        code: 'PLAYER_NOT_FOUND',
        message: '未找到该玩家，请检查 ID 是否正确。',
      },
    });
    expect(enResult).toMatchObject({
      status: 'rejected',
      reason: {
        code: 'PLAYER_NOT_FOUND',
        message: 'Player not found. Please check the ID.',
      },
    });
  });

  it('turns a hung request into a retryable timeout error', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      async (_url, options = {}) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        })
    );

    const pending = createOpenDotaClient('en').getPlayer(42);
    const timeoutExpectation = expect(pending).rejects.toMatchObject({
      code: 'TIMEOUT',
      resource: 'player',
      retryable: true,
      message: 'OpenDota timed out. Please retry or switch players.',
    });
    await vi.advanceTimersByTimeAsync(openDotaClientTesting.requestTimeoutMs);

    await timeoutExpectation;
  });

  it('does not retry a rate limit as a projection compatibility fallback', async () => {
    globalThis.fetch = vi.fn(async () => response({}, 429, { 'retry-after': '12' }));

    await expect(
      createOpenDotaClient('en').getPlayerMatchesByDays(42, 30)
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      resource: 'playerMatches',
      retryable: true,
      retryAfter: 12,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('recognizes only explicit 400/422 projection errors as fallback candidates', () => {
    const invalidProjection = new OpenDotaError('invalid', {
      code: 'INVALID_REQUEST',
      status: 422,
      resource: 'playerMatches',
    });
    const rateLimit = new OpenDotaError('limited', {
      code: 'RATE_LIMITED',
      status: 429,
      resource: 'playerMatches',
    });

    expect(openDotaClientTesting.isProjectionUnsupportedError(invalidProjection)).toBe(true);
    expect(openDotaClientTesting.isProjectionUnsupportedError(rateLimit)).toBe(false);
  });

  it('builds useful ability fallbacks from both supported constants shapes', () => {
    const names = openDotaClientTesting.buildAbilityNameById({
      100: 'npc_dota_axe_berserkers_call',
      lina_dragon_slave: 200,
      300: {
        dname: 'Dream Coil',
      },
    });

    expect(names.get(100)).toBe('Axe Berserkers Call');
    expect(names.get(200)).toBe('Lina Dragon Slave');
    expect(names.get(300)).toBe('Dream Coil');
  });
});

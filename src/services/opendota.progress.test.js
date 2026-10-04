import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPlayerOptionalSlice, fetchPlayerWindowAnalytics } from './opendota.js';
import { invalidateOpenDotaCache } from './opendotaClient.js';

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { invalidateOpenDotaCache(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('progressive OpenDota aggregation', () => {
  it('renders the real core snapshot before a stalled peer request, then retries only peers', async () => {
    const peers = deferred();
    const coreReady = deferred();
    const startTime = Math.floor(Date.now() / 1000) - 3600;
    const match = { match_id: 123, hero_id: 1, start_time: startTime, player_slot: 0, radiant_win: true, duration: 1800, kills: 5, deaths: 2, assists: 9, gold_per_min: 450, xp_per_min: 600 };
    const fetch = vi.fn(async (input) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/peers')) return peers.promise;
      if (url.pathname.endsWith('/matches')) return Response.json([match]);
      if (url.pathname.endsWith('/recentMatches')) return Response.json([match]);
      if (url.pathname === '/api/players/42') return Response.json({ profile: { personaname: 'Fixture', avatarfull: 'https://tracker.example/a' } });
      throw new Error(`Unexpected fixture endpoint: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);
    const snapshots = [];
    const controller = new AbortController();
    const request = fetchPlayerWindowAnalytics('42', 30, controller.signal, 'en', { onProgress(snapshot) { snapshots.push(snapshot); if (snapshots.length === 1) coreReady.resolve(snapshot); } });
    const initial = await coreReady.promise;
    expect(initial.totalMatches).toBe(1);
    expect(initial.playerName).toBe('Fixture');
    expect(initial.playerAvatar).toBe('');
    expect(initial.dataCoverage.optionalSlices.teammates).toBe('loading');
    peers.resolve(Response.json({}, { status: 503 }));
    const partial = await request;
    expect(partial.windowMatches).toHaveLength(1);
    expect(partial.accessIssues).toEqual([expect.objectContaining({ slice: 'teammates', status: 503 })]);
    expect(partial.dataCoverage.optionalSlices.recentMatches).toBe('available');
    const callCount = fetch.mock.calls.length;
    fetch.mockResolvedValueOnce(Response.json([{ account_id: 7, personaname: 'Peer', with_games: 2, with_win: 1 }]));
    const recovered = await fetchPlayerOptionalSlice('42', 'teammates', controller.signal, 'en');
    expect(recovered.issue).toBeNull();
    expect(recovered.patch.teammates).toHaveLength(1);
    expect(fetch.mock.calls.length).toBe(callCount + 1);
    expect(new URL(fetch.mock.lastCall[0]).pathname).toBe('/api/players/42/peers');
    expect(partial.asOf).toBe(initial.asOf);
  });
});

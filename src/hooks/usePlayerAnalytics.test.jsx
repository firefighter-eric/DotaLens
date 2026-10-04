// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPlayerOptionalSlice, fetchPlayerWindowAnalytics } from '../services/opendota.js';
import { invalidateOpenDotaCache } from '../services/opendotaClient.js';
import { usePlayerAnalytics } from './usePlayerAnalytics.js';

vi.mock('../services/opendota.js', () => ({
  fetchPlayerWindowAnalytics: vi.fn(),
  fetchPlayerOptionalSlice: vi.fn(),
}));

vi.mock('../services/opendotaClient.js', () => ({
  invalidateOpenDotaCache: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePlayerAnalytics request lifecycle', () => {
  it('publishes core data early and merges a slice retry without losing it to another late slice', async () => {
    let progress;
    let finish;
    const core = { playerName: 'Early Player', asOf: 100, teammates: [], accessIssues: [{ slice: 'teammates', code: 'NETWORK_ERROR' }], dataCoverage: { optionalSlices: { teammates: 'unavailable', recentMatches: 'loading' } } };
    fetchPlayerWindowAnalytics.mockImplementation((_id, _days, _signal, _lang, options) => {
      progress = options.onProgress;
      progress(core);
      return new Promise((resolve) => { finish = resolve; });
    });
    fetchPlayerOptionalSlice.mockResolvedValue({ patch: { teammates: [{ accountId: 5 }] }, issue: null });
    const { result } = renderHook(() => usePlayerAnalytics({ accountId: '42', days: 30, lang: 'en' }));
    await waitFor(() => expect(result.current.data.playerName).toBe('Early Player'));
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.asOf).toBe(100);
    await act(async () => { await result.current.retrySlice('teammates'); });
    const recent = { patch: { recentMatches: [{ matchId: 7 }] }, issue: null };
    await act(async () => { progress({ ...core, ...recent.patch }, { slice: 'recentMatches', result: recent }); finish({ ...core, ...recent.patch }); });
    expect(result.current.data.teammates).toEqual([{ accountId: 5 }]);
    expect(result.current.data.recentMatches).toEqual([{ matchId: 7 }]);
    expect(result.current.data.accessIssues).toEqual([]);
    expect(result.current.data.dataCoverage.complete).toBe(true);
    expect(fetchPlayerWindowAnalytics).toHaveBeenCalledOnce();
    expect(fetchPlayerOptionalSlice.mock.calls[0].slice(0, 2)).toEqual(['42', 'teammates']);
  });

  it('aborts query A and starts query B when the player changes', async () => {
    const requests = [];
    fetchPlayerWindowAnalytics.mockImplementation(
      (accountId, days, signal) =>
        new Promise((resolve) => {
          requests.push({ accountId, days, signal, resolve });
        })
    );

    const { result, rerender } = renderHook(
      ({ accountId }) =>
        usePlayerAnalytics({
          accountId,
          days: 30,
          lang: 'en',
          reloadKey: 0,
        }),
      { initialProps: { accountId: '1' } }
    );

    await waitFor(() => expect(requests).toHaveLength(1));
    rerender({ accountId: '2' });
    await waitFor(() => expect(requests).toHaveLength(2));

    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].signal.aborted).toBe(false);

    await act(async () => {
      requests[1].resolve({
        playerName: 'Player 2',
        accessIssues: [],
      });
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.queryKey).toBe('2:30');
    expect(result.current.data.playerName).toBe('Player 2');
  });

  it('invalidates only on an explicit same-query reload', async () => {
    fetchPlayerWindowAnalytics.mockResolvedValue({
      playerName: 'Player',
      accessIssues: [],
    });

    const { rerender } = renderHook(
      ({ reloadKey }) =>
        usePlayerAnalytics({
          accountId: '7',
          days: 365,
          lang: 'zh',
          reloadKey,
        }),
      { initialProps: { reloadKey: 0 } }
    );

    await waitFor(() =>
      expect(fetchPlayerWindowAnalytics).toHaveBeenCalledTimes(1)
    );
    expect(invalidateOpenDotaCache).not.toHaveBeenCalled();

    rerender({ reloadKey: 1 });
    await waitFor(() =>
      expect(fetchPlayerWindowAnalytics).toHaveBeenCalledTimes(2)
    );
    expect(invalidateOpenDotaCache).toHaveBeenCalledWith({
      accountId: '7',
      days: 365,
    });
  });
});

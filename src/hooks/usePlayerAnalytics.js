import { applyOptionalResource } from '../utils/optionalResources.js';
import { useEffect, useRef, useState } from 'react';
import { fetchPlayerOptionalSlice, fetchPlayerWindowAnalytics } from '../services/opendota.js';
import { invalidateOpenDotaCache } from '../services/opendotaClient.js';

const EMPTY_RESOURCE = Object.freeze({
  status: 'idle',
  data: null,
  error: null,
  queryKey: '',
  accountId: '',
  days: null,
  source: null,
  asOf: null,
  isRefreshing: false,
  stale: false,
});

export const createAnalyticsQueryKey = (accountId, days) =>
  accountId ? `${String(accountId)}:${Number(days)}` : '';

const normalizeResourceError = (error) => ({
  name: error?.name || 'Error',
  code: error?.code || 'UNKNOWN',
  status: Number.isFinite(error?.status) ? error.status : null,
  resource: error?.resource || 'player-analytics',
  retryable: error?.retryable !== false,
  retryAfter: Number.isFinite(error?.retryAfter) ? error.retryAfter : null,
  message: error?.message || '',
});

/**
 * Owns the account/window request lifecycle so data can never be rendered under
 * a different query context. Locale changes may refresh the localized view model
 * while retaining data only when the account and window are unchanged.
 */
export function usePlayerAnalytics({ accountId, days, lang, reloadKey = 0 }) {
  const [resource, setResource] = useState(EMPTY_RESOURCE);
  const requestSequence = useRef(0);
  const previousReloadKey = useRef(reloadKey);
  const sliceControllers = useRef(new Map());

  useEffect(() => {
    const queryKey = createAnalyticsQueryKey(accountId, days);
    if (!queryKey) {
      setResource(EMPTY_RESOURCE);
      return undefined;
    }

    const controller = new AbortController();
    const pendingSlices = sliceControllers.current;
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const shouldForceRefresh = previousReloadKey.current !== reloadKey;
    previousReloadKey.current = reloadKey;
    if (shouldForceRefresh) {
      invalidateOpenDotaCache({ accountId, days });
    }

    setResource((previous) => {
      const canRetain = previous.queryKey === queryKey && Boolean(previous.data);
      return {
        status: canRetain ? previous.status : 'loading',
        data: canRetain ? previous.data : null,
        error: null,
        queryKey,
        accountId: String(accountId),
        days: Number(days),
        source: canRetain ? previous.source : null,
        asOf: canRetain ? previous.asOf : null,
        isRefreshing: canRetain,
        stale: false,
      };
    });

    let published = false;
    const publish = (snapshot, event) => {
      if (controller.signal.aborted || requestSequence.current !== requestId) return;
      published = true;
      setResource((previous) => {
        const data = event?.slice && previous.queryKey === queryKey && previous.data
          ? applyOptionalResource(previous.data, event.slice, event.result)
          : snapshot;
        const asOf = data.asOf ?? Date.now();
        return {
          status: data.accessIssues?.length ? 'partial' : 'success',
          data: { ...data, source: 'opendota', queryKey, accountId: String(accountId), windowDays: Number(days), asOf },
          error: null, queryKey, accountId: String(accountId), days: Number(days),
          source: 'opendota', asOf, isRefreshing: false, stale: false,
        };
      });
    };
    const load = async () => {
      try {
        const data = await fetchPlayerWindowAnalytics(accountId, days, controller.signal, lang, { onProgress: publish });
        if (!published) publish(data);
      } catch (error) {
        if (controller.signal.aborted || requestSequence.current !== requestId) {
          return;
        }
        // A failed core query no longer needs its outstanding supplemental work.
        controller.abort();

        setResource((previous) => {
          const canRetain = previous.queryKey === queryKey && Boolean(previous.data);
          return {
            status: 'error',
            data: canRetain ? previous.data : null,
            error: normalizeResourceError(error),
            queryKey,
            accountId: String(accountId),
            days: Number(days),
            source: canRetain ? previous.source : null,
            asOf: canRetain ? previous.asOf : null,
            isRefreshing: false,
            stale: canRetain,
          };
        });
      }
    };

    load();

    return () => {
      controller.abort();
      pendingSlices.forEach((pending) => pending.abort());
      pendingSlices.clear();
    };
  }, [accountId, days, lang, reloadKey]);

  const retrySlice = async (slice) => {
    if (!accountId || !['recentMatches', 'teammates'].includes(slice)) return;
    const queryKey = createAnalyticsQueryKey(accountId, days);
    const requestId = requestSequence.current;
    const controller = new AbortController();
    sliceControllers.current.get(slice)?.abort();
    sliceControllers.current.set(slice, controller);
    const update = (transform) => setResource((previous) => {
      if (controller.signal.aborted || requestSequence.current !== requestId || previous.queryKey !== queryKey || !previous.data) return previous;
      const data = transform(previous.data);
      return { ...previous, data, status: data.accessIssues?.length ? 'partial' : 'success' };
    });
    update((data) => ({ ...data, dataCoverage: { ...data.dataCoverage,
      complete: false, optionalSlices: { ...data.dataCoverage?.optionalSlices, [slice]: 'loading' } } }));
    try {
      const result = await fetchPlayerOptionalSlice(accountId, slice, controller.signal, lang);
      update((data) => applyOptionalResource(data, slice, result));
    } catch (error) {
      if (error.name !== 'AbortError') update((data) => applyOptionalResource(data, slice, {
        patch: {}, issue: { ...normalizeResourceError(error), slice },
      }));
    } finally {
      if (sliceControllers.current.get(slice) === controller) sliceControllers.current.delete(slice);
    }
  };
  return { ...resource, retrySlice };
}

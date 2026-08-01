import { useEffect, useRef, useState } from 'react';
import { fetchPlayerWindowAnalytics } from '../services/opendota.js';
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

  useEffect(() => {
    const queryKey = createAnalyticsQueryKey(accountId, days);
    if (!queryKey) {
      setResource(EMPTY_RESOURCE);
      return undefined;
    }

    const controller = new AbortController();
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

    const load = async () => {
      try {
        const data = await fetchPlayerWindowAnalytics(accountId, days, controller.signal, lang);
        if (controller.signal.aborted || requestSequence.current !== requestId) {
          return;
        }

        const accessIssues = Array.isArray(data?.accessIssues) ? data.accessIssues : [];
        setResource({
          status: accessIssues.length > 0 ? 'partial' : 'success',
          data: {
            ...data,
            source: 'opendota',
            queryKey,
            accountId: String(accountId),
            windowDays: Number(days),
            asOf: Date.now(),
          },
          error: null,
          queryKey,
          accountId: String(accountId),
          days: Number(days),
          source: 'opendota',
          asOf: Date.now(),
          isRefreshing: false,
          stale: false,
        });
      } catch (error) {
        if (controller.signal.aborted || requestSequence.current !== requestId) {
          return;
        }

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
    };
  }, [accountId, days, lang, reloadKey]);

  return resource;
}

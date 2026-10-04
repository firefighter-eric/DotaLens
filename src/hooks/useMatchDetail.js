import { useEffect, useMemo, useState } from 'react';
import { fetchRecentMatchDetail } from '../services/opendota.js';
import { createMockRecentMatchDetail } from '../services/mockAnalytics.js';
import { invalidateOpenDotaCache } from '../services/opendotaClient.js';
import { TAB_IDS } from '../config/workspace.js';

export function useMatchDetail({ selectableMatchesById, dashboard, queryAccountId, days, reloadKey, lang, copy, activeTab }) {
  const [selectedRecentMatchId, setSelectedRecentMatchId] = useState(null);
  const [recentMatchDetail, setRecentMatchDetail] = useState(null);
  const [recentMatchDetailLoading, setRecentMatchDetailLoading] = useState(false);
  const [recentMatchDetailError, setRecentMatchDetailError] = useState(null);
  const [recentMatchDetailReloadKey, setRecentMatchDetailReloadKey] = useState(0);
  const selectableMatches = useMemo(() => Array.from(selectableMatchesById.values()), [selectableMatchesById]);
  const selectedRecentMatch = useMemo(
    () => selectableMatches.find((item) => item.matchId === selectedRecentMatchId) ?? null,
    [selectableMatches, selectedRecentMatchId]
  );
  useEffect(() => {
    setSelectedRecentMatchId(null);
    setRecentMatchDetail(null);
    setRecentMatchDetailError(null);
    setRecentMatchDetailLoading(false);
  }, [queryAccountId, days, reloadKey]);
  useEffect(() => {
    if (!selectedRecentMatchId) {
      return;
    }

    const exists = selectableMatches.some((item) => item.matchId === selectedRecentMatchId);
    if (!exists) {
      setSelectedRecentMatchId(null);
      setRecentMatchDetail(null);
      setRecentMatchDetailError(null);
      setRecentMatchDetailLoading(false);
    }
  }, [selectableMatches, selectedRecentMatchId]);

  useEffect(() => {
    if (!selectedRecentMatch) {
      return undefined;
    }

    const controller = new AbortController();
    setRecentMatchDetail(null);
    setRecentMatchDetailError(null);
    setRecentMatchDetailLoading(true);

    const load = async () => {
      if (dashboard.source === 'mock') {
        const mockDetail = createMockRecentMatchDetail(selectedRecentMatch, lang);
        if (!controller.signal.aborted) {
          setRecentMatchDetail(mockDetail);
          setRecentMatchDetailLoading(false);
        }
        return;
      }

      try {
        const detail = await fetchRecentMatchDetail(queryAccountId, selectedRecentMatch.matchId, controller.signal, lang, {
          heroId: selectedRecentMatch.heroId,
          hero: selectedRecentMatch.hero,
          heroAvatar: selectedRecentMatch.heroAvatar,
          playerName: dashboard.playerName,
          playerAvatar: dashboard.playerAvatar,
          playerSlot: selectedRecentMatch.playerSlot,
          startTime: selectedRecentMatch.startTime,
          durationSec: selectedRecentMatch.durationSec,
        });

        if (!controller.signal.aborted) {
          setRecentMatchDetail(detail);
        }
      } catch (loadError) {
        if (!controller.signal.aborted && loadError.name !== 'AbortError') {
          setRecentMatchDetailError({
            code: loadError?.code || 'MATCH_DETAIL_FAILED',
            status: Number.isFinite(loadError?.status) ? loadError.status : null,
            retryable: loadError?.retryable !== false,
            retryAfter: Number.isFinite(loadError?.retryAfter)
              ? loadError.retryAfter
              : null,
            message:
              loadError?.message ||
              copy.recentMatches?.detail?.loadFailed ||
              copy.errors.fetchFailed,
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecentMatchDetailLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [
    selectedRecentMatch,
    dashboard.source,
    dashboard.playerName,
    dashboard.playerAvatar,
    queryAccountId,
    lang,
    copy.recentMatches?.detail?.loadFailed,
    copy.errors.fetchFailed,
    recentMatchDetailReloadKey,
  ]);

  const handleOpenRecentMatchDetail = (match) => {
    if (!match?.matchId) {
      return;
    }
    setSelectedRecentMatchId(match.matchId);
  };

  const handleCloseRecentMatchDetail = () => {
    setSelectedRecentMatchId(null);
    setRecentMatchDetail(null);
    setRecentMatchDetailError(null);
    setRecentMatchDetailLoading(false);
  };

  const handleRetryRecentMatchDetail = () => {
    if (recentMatchDetailError?.retryable === false) {
      return;
    }
    if (selectedRecentMatchId) {
      invalidateOpenDotaCache({ matchId: selectedRecentMatchId });
    }
    setRecentMatchDetailError(null);
    setRecentMatchDetailReloadKey((value) => value + 1);
  };

  useEffect(() => {
    if (activeTab === TAB_IDS.recentMatches || activeTab === TAB_IDS.heroes || activeTab === TAB_IDS.overview) {
      return;
    }
    if (selectedRecentMatchId) {
      setSelectedRecentMatchId(null);
      setRecentMatchDetail(null);
      setRecentMatchDetailError(null);
      setRecentMatchDetailLoading(false);
    }
  }, [activeTab, selectedRecentMatchId]);

  return { selectedRecentMatchId, selectedRecentMatch, recentMatchDetail, recentMatchDetailLoading, recentMatchDetailError, handleOpenRecentMatchDetail, handleCloseRecentMatchDetail, handleRetryRecentMatchDetail };
}

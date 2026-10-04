import { useWorkspacePreferences } from './hooks/useWorkspacePreferences.js';
import CatalogPanel from './components/CatalogPanel.jsx';
import ResourceIssue from './components/ResourceIssue.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import OverviewPanel from './components/OverviewPanel.jsx';
import { useEffect, useMemo, useState } from 'react';
import WorkspaceHeader from './components/WorkspaceHeader.jsx';
import { TAB_IDS, panelLabelId } from './config/workspace.js';
import WinRateTrend from './components/WinRateTrend.jsx';
import HourlyMatchTrend from './components/HourlyMatchTrend.jsx';
import HeroPerformanceTable from './components/HeroPerformanceTable.jsx';
import RecentMatchesPanel from './components/RecentMatchesPanel.jsx';
import RecentMatchDetailDrawer from './components/RecentMatchDetailDrawer.jsx';
import TeammatesPanel from './components/TeammatesPanel.jsx';
import AccountModal from './components/AccountModal.jsx';
import { createMockDashboard } from './services/mockAnalytics.js';
import {
  buildHourlyMatchDistribution,
  resolveHeroWinRate,
  summarizeRecentMatches,
} from './utils/metrics.js';
import { useMatchDetail } from './hooks/useMatchDetail.js';
import { createOpenDotaClient } from './services/opendotaClient.js';
import { getCopy } from './i18n/copy.js';
import { createAnalyticsQueryKey, usePlayerAnalytics } from './hooks/usePlayerAnalytics.js';
import { formatMatchDate } from './utils/display.js';
import { compareHeroes, escapeCsvCell, getHeroAttributeKey } from './utils/heroPerformance.js';
import { MAX_SAVED_ACCOUNTS } from './utils/accountSession.js';
import { useAccountSession } from './hooks/useAccountSession.js';


const RECENT_MATCHES_PAGE_SIZE = 30;
function App() {
  const { lang, setLang, activeTab, setActiveTab } = useWorkspacePreferences();
  const copy = useMemo(() => getCopy(lang), [lang]);
  const { inputAccountId, setInputAccountId, savedAccounts, setSavedAccounts, isAccountModalOpen, setIsAccountModalOpen, queryAccountId, queryRawId, reloadKey, setReloadKey, days, setDays, showSample, setShowSample, inputError, setInputError, handleSubmit, handleSwitchAccount, handleRemoveSavedAccount } = useAccountSession(copy);

  const [recentMatchesPage, setRecentMatchesPage] = useState(1);
  const [sortKey, setSortKey] = useState('winRate');
  const [sortDir, setSortDir] = useState('desc');
  const [attributeFilter, setAttributeFilter] = useState('all');
  const [minMatches, setMinMatches] = useState(2);
  const [selectedHeroRowId, setSelectedHeroRowId] = useState(null);
  const [heroRowManuallyCollapsed, setHeroRowManuallyCollapsed] = useState(false);
  const [heroMetaById, setHeroMetaById] = useState(() => new Map());
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0);
  const analyticsResource = usePlayerAnalytics({
    accountId: queryAccountId,
    days,
    lang,
    reloadKey,
  });
  const sampleDashboard = useMemo(() => createMockDashboard(copy, lang), [copy, lang]);
  const activeAnalyticsQueryKey = createAnalyticsQueryKey(queryAccountId, days);
  const resourceMatchesActiveQuery =
    Boolean(activeAnalyticsQueryKey) && analyticsResource.queryKey === activeAnalyticsQueryKey;
  const hasLiveDashboard =
    resourceMatchesActiveQuery && Boolean(analyticsResource.data);
  const dashboard = hasLiveDashboard ? analyticsResource.data : sampleDashboard;
  const loading =
    Boolean(activeAnalyticsQueryKey) &&
    (!resourceMatchesActiveQuery || analyticsResource.status === 'loading' || analyticsResource.isRefreshing);
  const queryResourceError = resourceMatchesActiveQuery ? analyticsResource.error : null;
  const queryError = queryResourceError?.message || '';
  const teammateAccessIssue = Array.isArray(dashboard.accessIssues)
    ? dashboard.accessIssues.find((issue) => issue?.slice === 'teammates') ?? null
    : null;
  const selectableMatchesById = useMemo(() => {
    const merged = [...(dashboard.recentMatches ?? []), ...(dashboard.windowMatches ?? [])];
    const byMatchId = new Map();
    merged.forEach((match) => {
      if (match?.matchId && !byMatchId.has(match.matchId)) {
        byMatchId.set(match.matchId, match);
      }
    });
    return byMatchId;
  }, [dashboard.recentMatches, dashboard.windowMatches]);

  const { selectedRecentMatchId, selectedRecentMatch, recentMatchDetail, recentMatchDetailLoading, recentMatchDetailError, handleOpenRecentMatchDetail, handleCloseRecentMatchDetail, handleRetryRecentMatchDetail } = useMatchDetail({ selectableMatchesById, dashboard, queryAccountId, days, reloadKey, lang, copy, activeTab });


  useEffect(() => {
    const retryAfter = Number(queryResourceError?.retryAfter);
    if (!queryError || !Number.isFinite(retryAfter) || retryAfter <= 0) {
      setRetryDelaySeconds(0);
      return undefined;
    }

    setRetryDelaySeconds(Math.ceil(retryAfter));
    const timer = window.setInterval(() => {
      setRetryDelaySeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [queryError, queryResourceError?.retryAfter]);


  useEffect(() => {
    if (activeTab !== TAB_IDS.allHeroes) {
      return undefined;
    }

    const controller = new AbortController();
    const client = createOpenDotaClient(lang);

    const loadHeroMeta = async () => {
      try {
        const map = await client.getHeroesMetaMap(controller.signal);
        if (!controller.signal.aborted) {
          setHeroMetaById(map);
        }
      } catch {
        if (!controller.signal.aborted) {
          setHeroMetaById(new Map());
        }
      }
    };

    loadHeroMeta();

    return () => {
      controller.abort();
    };
  }, [activeTab, lang]);

  useEffect(() => {
    const data = analyticsResource.data;
    if (!data || analyticsResource.queryKey !== `${queryAccountId}:${days}`) {
      return;
    }

    setSavedAccounts((previous) =>
      previous.map((account) =>
        account.accountId === queryAccountId
          ? {
              ...account,
              nickname: data.playerName,
              avatar: data.playerAvatar || account.avatar || '',
            }
          : account
      )
    );
  }, [analyticsResource.data, analyticsResource.queryKey, days, queryAccountId, setSavedAccounts]);

  useEffect(() => {
    setSelectedHeroRowId(null);
    setHeroRowManuallyCollapsed(false);
    setRecentMatchesPage(1);
  }, [queryAccountId, days, reloadKey]);

  const availableAttributes = useMemo(() => {
    const options = new Map(dashboard.heroPerformance.map((hero) => [getHeroAttributeKey(hero), hero.attribute]));
    return Array.from(options, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, lang));
  }, [dashboard.heroPerformance, lang]);

  useEffect(() => {
    if (attributeFilter !== 'all' && !availableAttributes.some((option) => option.value === attributeFilter)) {
      setAttributeFilter('all');
    }
  }, [attributeFilter, availableAttributes]);

  const filteredHeroes = useMemo(() => {
    return dashboard.heroPerformance
      .filter((hero) => (attributeFilter === 'all' ? true : getHeroAttributeKey(hero) === attributeFilter))
      .filter((hero) => hero.matches >= minMatches)
      .slice()
      .sort((a, b) => compareHeroes(a, b, sortKey, sortDir, lang));
  }, [attributeFilter, dashboard.heroPerformance, lang, minMatches, sortDir, sortKey]);

  useEffect(() => {
    if (!selectedHeroRowId) {
      return;
    }
    const hasSelectedHero = filteredHeroes.some((hero) => (hero.heroId ?? hero.hero) === selectedHeroRowId);
    if (!hasSelectedHero) {
      setSelectedHeroRowId(null);
      setHeroRowManuallyCollapsed(false);
    }
  }, [filteredHeroes, selectedHeroRowId]);

  useEffect(() => {
    if (selectedHeroRowId || filteredHeroes.length === 0 || heroRowManuallyCollapsed) {
      return;
    }
    const firstHero = filteredHeroes[0];
    const firstHeroId = firstHero.heroId ?? firstHero.hero;
    if (firstHeroId) {
      setSelectedHeroRowId(firstHeroId);
    }
  }, [filteredHeroes, heroRowManuallyCollapsed, selectedHeroRowId]);

  const paginatedRecentMatches = useMemo(() => dashboard.windowMatches ?? [], [dashboard.windowMatches]);
  const recentMatchesTotalPages = Math.max(1, Math.ceil(paginatedRecentMatches.length / RECENT_MATCHES_PAGE_SIZE));
  const clampedRecentMatchesPage = Math.min(recentMatchesPage, recentMatchesTotalPages);
  const visibleRecentMatches = useMemo(() => {
    const start = (clampedRecentMatchesPage - 1) * RECENT_MATCHES_PAGE_SIZE;
    return paginatedRecentMatches.slice(start, start + RECENT_MATCHES_PAGE_SIZE);
  }, [clampedRecentMatchesPage, paginatedRecentMatches]);
  useEffect(() => {
    if (recentMatchesPage !== clampedRecentMatchesPage) {
      setRecentMatchesPage(clampedRecentMatchesPage);
    }
  }, [recentMatchesPage, clampedRecentMatchesPage]);
  const heroMatchesMap = useMemo(() => {
    const grouped = new Map();
    (dashboard.windowMatches ?? []).forEach((match) => {
      const key = match.heroId ?? match.hero;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(match);
      } else {
        grouped.set(key, [match]);
      }
    });
    return grouped;
  }, [dashboard.windowMatches]);
  const recentMatchSummary = useMemo(() => summarizeRecentMatches(paginatedRecentMatches), [paginatedRecentMatches]);
  const handleMinMatchesChange = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setMinMatches(0);
      return;
    }
    setMinMatches(parsed);
  };

  const handleExportHeroes = () => {
    if (!filteredHeroes.length) {
      return;
    }

    const header = copy.table.headers;
    const rows = [
      [
        header.hero,
        header.attribute,
        header.matches,
        header.knownOutcomes,
        header.unknownOutcomes,
        header.winRate,
        header.avgKda,
        header.avgGpm,
        header.avgXpm,
        header.impact,
      ],
      ...filteredHeroes.map((hero) => [
        hero.hero,
        hero.attribute,
        hero.matches,
        Number.isFinite(hero.outcomeMatches)
          ? hero.outcomeMatches
          : hero.matches,
        Number.isFinite(hero.unknownOutcomes)
          ? hero.unknownOutcomes
          : Math.max(
              0,
              hero.matches -
                (Number.isFinite(hero.outcomeMatches)
                  ? hero.outcomeMatches
                  : hero.matches)
            ),
        resolveHeroWinRate(hero) === null
          ? '-'
          : `${resolveHeroWinRate(hero).toFixed(1)}%`,
        Number.isFinite(hero.avgKda) ? hero.avgKda : '-',
        Number.isFinite(hero.avgGpm) ? hero.avgGpm : '-',
        Number.isFinite(hero.avgXpm) ? hero.avgXpm : '-',
        Number.isFinite(hero.impact) ? hero.impact : '-',
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dotalens-${queryAccountId || 'sample'}-${days}d-heroes.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSelectHeroRow = (hero) => {
    if (!hero) {
      return;
    }
    const rowId = hero.heroId ?? hero.hero;
    if (selectedHeroRowId === rowId) {
      setSelectedHeroRowId(null);
      setHeroRowManuallyCollapsed(true);
      return;
    }
    setSelectedHeroRowId(rowId);
    setHeroRowManuallyCollapsed(false);
  };

  const isSampleDashboard = !hasLiveDashboard && showSample;
  const dashboardVisible = hasLiveDashboard || isSampleDashboard;
  const isCatalog = activeTab === TAB_IDS.allHeroes || activeTab === TAB_IDS.allItems;
  const showWelcome = activeTab === TAB_IDS.overview && isSampleDashboard;
  const [panelAttempt, setPanelAttempt] = useState(0);
  const statusLine = queryError
    ? queryError
    : loading && !hasLiveDashboard
      ? copy.query.loading
      : isSampleDashboard
        ? copy.status.mock
        : queryAccountId && hasLiveDashboard
          ? dashboard.totalMatches === 0
            ? copy.status.noRecentMatches({
                playerName: dashboard.playerName,
                days,
                latestMatchDate: formatMatchDate(dashboard.latestMatchStartTime, lang),
              })
            : copy.status.steam({
                playerName: dashboard.playerName,
                rawId: queryRawId,
                days,
                totalMatches: dashboard.totalMatches,
              })
          : copy.query.loading;
  const resourceStatusCopy = copy.resourceStatus ?? {};
  const provenanceCopy = copy.provenance ?? {};
  const retryLabel = resourceStatusCopy.retry ?? copy.query.submit;
  const viewSampleLabel = resourceStatusCopy.viewSample ?? copy.misc.samplePlayerName;
  const retryIsDisallowed = queryResourceError?.retryable === false;
  const retryIsWaiting = !retryIsDisallowed && retryDelaySeconds > 0;
  const recoveryLabel = retryIsDisallowed
    ? resourceStatusCopy.changePlayer ?? copy.query.openAccountModal
    : retryIsWaiting && typeof resourceStatusCopy.retryAfter === 'function'
      ? resourceStatusCopy.retryAfter(retryDelaySeconds)
      : retryLabel;
  const handleQueryRecovery = () => {
    if (!queryAccountId || retryIsDisallowed) {
      setIsAccountModalOpen(true);
      return;
    }
    if (retryIsWaiting) {
      return;
    }
    setShowSample(false);
    setReloadKey((value) => value + 1);
  };
  const handlePrimaryPlayerAction = () => {
    if (queryError) {
      handleQueryRecovery();
      return;
    }
    if (isSampleDashboard && queryAccountId) {
      setShowSample(false);
      setReloadKey((value) => value + 1);
      return;
    }
    setIsAccountModalOpen(true);
  };
  const primaryPlayerActionLabel = queryError
    ? recoveryLabel
    : isSampleDashboard && queryAccountId
      ? retryLabel
      : copy.query.submit;
  const liveDataAsOf = dashboard.asOf
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dashboard.asOf))
    : '';
  const liveDataCoverage = dashboard.dataCoverage
    ? {
        includedMatches: dashboard.dataCoverage.includedMatches ?? dashboard.totalMatches ?? 0,
        retrievedMatches: dashboard.dataCoverage.retrievedMatches ?? dashboard.totalMatches ?? 0,
      }
    : null;

  const activeAccount = savedAccounts.find((account) => account.accountId === queryAccountId && account.rawId === queryRawId);
  const activeAccountNickname = activeAccount?.nickname || dashboard.playerName || queryRawId || copy.query.unknownNickname;
  const activeAccountAvatar = activeAccount?.avatar || dashboard.playerAvatar || '';
  const kdaTrendCopy = {
    ...copy.trend,
    title: copy.trend.kdaTitle,
    latestValue: copy.trend.latestKda,
    ariaLabel: copy.trend.kdaAriaLabel,
    axisValue: copy.trend.kdaAxisValue,
  };
  const gpmTrendCopy = {
    ...copy.trend,
    title: copy.trend.gpmTitle,
    latestValue: copy.trend.latestGpm,
    latestDualValue: copy.trend.latestGpmXpm,
    ariaLabel: copy.trend.gpmAriaLabel,
    axisValue: copy.trend.gpmAxisValue,
    primarySeriesLabel: copy.trend.gpmSeriesLabel,
    secondarySeriesLabel: copy.trend.xpmSeriesLabel,
  };
  const hourlyMatchDistribution = useMemo(
    () => buildHourlyMatchDistribution(dashboard.windowMatches ?? []),
    [dashboard.windowMatches]
  );

  return (
    <div className="app-shell">
      <WorkspaceHeader copy={copy} lang={lang} onLanguageChange={setLang} activeTab={activeTab} onTabChange={setActiveTab} playerName={activeAccountNickname} playerAvatar={activeAccountAvatar} onOpenAccount={() => setIsAccountModalOpen(true)} />

      <AccountModal
        open={isAccountModalOpen}
        copy={copy.query}
        inputAccountId={inputAccountId}
        onInputChange={(value) => {
          setInputAccountId(value);
          if (inputError) {
            setInputError('');
          }
        }}
        onSubmit={handleSubmit}
        loading={loading}
        inputError={inputError}
        savedAccounts={savedAccounts}
        activeAccountId={queryAccountId}
        activeRawId={queryRawId}
        maxSavedAccounts={MAX_SAVED_ACCOUNTS}
        onSwitchAccount={handleSwitchAccount}
        onRemoveAccount={handleRemoveSavedAccount}
        days={days}
        onDaysChange={setDays}
        onClose={() => setIsAccountModalOpen(false)}
      />

      <main className="dashboard" aria-busy={!isCatalog && loading}>
        <ErrorBoundary key={`${isCatalog ? 'catalog' : activeTab}:${panelAttempt}`} copy={copy.resourceStatus.renderError} onRetry={() => setPanelAttempt((value) => value + 1)}>
        {!isCatalog ? <section className={`dashboard-hero ${showWelcome ? '' : 'is-compact'}`}>
          <div className="dashboard-hero__copy">
            <h1>{showWelcome ? copy.app.title : copy.tabs[activeTab]}</h1>
            {showWelcome ? <p className="description">{copy.app.description}</p> : null}
          </div>

          {dashboardVisible && !isCatalog ? (
            <div className="dashboard-hero__status">
              <div
                className={`dashboard-hero__status-copy ${queryError && !isSampleDashboard ? 'is-error' : ''}`}
                role={queryError && !isSampleDashboard ? 'alert' : 'status'}
                aria-live="polite"
              >
                {isSampleDashboard ? <strong>{resourceStatusCopy.sampleTitle ?? copy.misc.samplePlayerName}</strong> : null}
                <span>{isSampleDashboard ? (showWelcome ? copy.status.mock : (days === 30 ? copy.query.day30 : copy.query.day365)) : statusLine}</span>
              </div>
              <button
                type="button"
                className="dashboard-hero__cta"
                onClick={handlePrimaryPlayerAction}
                disabled={Boolean(queryError) && retryIsWaiting}
              >
                {primaryPlayerActionLabel}
              </button>
            </div>
          ) : null}
        </section> : null}

        {!dashboardVisible && !isCatalog ? (
          <section className={`panel resource-state resource-state--${queryError ? 'error' : 'loading'}`} role={queryError ? 'alert' : 'status'}>
            <h2>{queryError ? resourceStatusCopy.errorTitle ?? copy.errors.fetchFailed : resourceStatusCopy.loadingTitle ?? copy.query.loading}</h2>
            <p>
              {queryError
                ? resourceStatusCopy.errorBody ?? queryError
                : resourceStatusCopy.loadingBody ?? copy.query.loading}
            </p>
            {queryError ? <p className="resource-state__detail">{queryError}</p> : null}
            {queryError ? (
              <div className="resource-state__actions">
                <button
                  type="button"
                  onClick={handleQueryRecovery}
                  disabled={retryIsWaiting}
                >
                  {queryAccountId ? recoveryLabel : copy.query.submit}
                </button>
                <button type="button" className="secondary-button" onClick={() => setShowSample(true)}>
                  {viewSampleLabel}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {dashboardVisible ? (
          <>
            {hasLiveDashboard && !isCatalog ? (
              <section className="data-source-banner data-source-banner--live" role="status">
                <strong>{provenanceCopy.liveTitle ?? 'OpenDota'}</strong>
                {liveDataAsOf ? (
                  <span>
                    {typeof provenanceCopy.updatedAt === 'function'
                      ? provenanceCopy.updatedAt(liveDataAsOf)
                      : liveDataAsOf}
                  </span>
                ) : null}
                {liveDataCoverage ? (
                  <span>
                    {typeof provenanceCopy.windowCoverage === 'function'
                      ? provenanceCopy.windowCoverage(liveDataCoverage)
                      : `${liveDataCoverage.includedMatches}/${liveDataCoverage.retrievedMatches}`}
                  </span>
                ) : null}
                <span>
                  {dashboard.dataCoverage?.complete === false
                    ? provenanceCopy.incomplete ?? resourceStatusCopy.partialTitle
                    : provenanceCopy.complete ?? ''}
                </span>
              </section>
            ) : null}

            {!isCatalog && Object.values(dashboard.dataCoverage?.optionalSlices ?? {}).includes('loading') ? <p className="data-source-banner" role="status">{resourceStatusCopy.supplementalLoading}</p> : null}
            {queryError && hasLiveDashboard && !isCatalog ? (
              <section className="data-source-banner data-source-banner--warning" role="alert">
                <strong>{resourceStatusCopy.staleTitle ?? copy.errors.fetchFailed}</strong>
                <span>{queryError}</span>
                <button
                  type="button"
                  onClick={handleQueryRecovery}
                  disabled={retryIsWaiting}
                >
                  {recoveryLabel}
                </button>
              </section>
            ) : null}

            {!isCatalog && Array.isArray(dashboard.accessIssues) && dashboard.accessIssues.length > 0 ? (
              <section className="data-source-banner data-source-banner--warning" role="status">
                <strong>{resourceStatusCopy.partialTitle ?? copy.errors.fetchFailed}</strong>
                <ul>
                  {dashboard.accessIssues.map((issue, index) => (
                    <ResourceIssue
                      key={`${issue?.slice ?? issue?.resource ?? 'slice'}-${issue?.code ?? index}`}
                      issue={issue}
                      loading={dashboard.dataCoverage?.optionalSlices?.[issue.slice] === 'loading'}
                      onRetry={['recentMatches', 'teammates'].includes(issue.slice) ? () => analyticsResource.retrySlice?.(issue.slice) : undefined}
                      copy={resourceStatusCopy}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

        {activeTab === TAB_IDS.overview ? <OverviewPanel dashboard={dashboard} copy={copy} lang={lang} days={days} setDays={setDays} setActiveTab={setActiveTab} selectableMatchesById={selectableMatchesById} selectedRecentMatchId={selectedRecentMatchId} handleOpenRecentMatchDetail={handleOpenRecentMatchDetail} /> : null}

        {activeTab === TAB_IDS.trend ? (
          <section
            id={`panel-${TAB_IDS.trend}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.trend)}
            className="tab-content"
            tabIndex={0}
          >
            <WinRateTrend data={dashboard.dailyWinRate} days={days} copy={copy.trend} percentage />
            <section className="two-cols trend-two-cols">
              <WinRateTrend data={dashboard.dailyKdaTrend ?? []} days={days} copy={kdaTrendCopy} />
              <WinRateTrend
                data={dashboard.dailyGpmTrend ?? []}
                secondaryData={dashboard.dailyXpmTrend ?? []}
                days={days}
                copy={gpmTrendCopy}
              />
            </section>
            <HourlyMatchTrend data={hourlyMatchDistribution} days={days} copy={copy.trend} />
          </section>
        ) : null}

        {activeTab === TAB_IDS.heroes ? (
          <section
            id={`panel-${TAB_IDS.heroes}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.heroes)}
            className="tab-content"
            tabIndex={0}
          >
            <HeroPerformanceTable
              heroes={filteredHeroes}
              attributes={availableAttributes}
              controls={{ sortKey, sortDir, attributeFilter, minMatches }}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              onAttributeFilterChange={setAttributeFilter}
              onMinMatchesChange={handleMinMatchesChange}
              onExport={handleExportHeroes}
              heroMatchesMap={heroMatchesMap}
              selectedHeroId={selectedHeroRowId}
              onSelectHero={handleSelectHeroRow}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
              recentCopy={copy.recentMatches}
              lang={lang}
              copy={copy.table}
            />
          </section>
        ) : null}

        {activeTab === TAB_IDS.teammates ? (
          <section
            id={`panel-${TAB_IDS.teammates}`}
            role="tabpanel"
            aria-labelledby={panelLabelId(TAB_IDS.teammates)}
            className="tab-content"
            tabIndex={0}
          >
            <TeammatesPanel
              teammates={dashboard.teammates ?? []}
              days={days}
              lang={lang}
              copy={copy.teammates}
              scope={dashboard.teammateScope ?? 'public-history'}
              error={teammateAccessIssue?.message ?? ''}
              errorRetryable={teammateAccessIssue?.retryable !== false}
              retryAfter={teammateAccessIssue?.retryAfter ?? null}
              loading={dashboard.dataCoverage?.optionalSlices?.teammates === 'loading'}
              onRetry={() => analyticsResource.retrySlice?.('teammates')}
            />
          </section>
        ) : null}

        {activeTab === TAB_IDS.recentMatches ? (
          <section
            id={`panel-${TAB_IDS.recentMatches}`}
            role="region"
            aria-labelledby={panelLabelId(TAB_IDS.recentMatches)}
            className="tab-content"
          >
            <RecentMatchesPanel
              matches={visibleRecentMatches}
              summary={recentMatchSummary}
              copy={copy.recentMatches}
              lang={lang}
              page={clampedRecentMatchesPage}
              pageSize={RECENT_MATCHES_PAGE_SIZE}
              totalCount={paginatedRecentMatches.length}
              totalPages={recentMatchesTotalPages}
              onPageChange={setRecentMatchesPage}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
            />
          </section>
        ) : null}

          </>
        ) : null}
        {isCatalog ? <section id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={panelLabelId(activeTab)} className="tab-content" tabIndex={0}>
          <CatalogPanel kind={activeTab === TAB_IDS.allHeroes ? 'heroes' : 'items'} lang={lang} copy={copy} heroMetaById={heroMetaById} />
        </section> : null}
        </ErrorBoundary>
      </main>

      <RecentMatchDetailDrawer
        open={Boolean(selectedRecentMatchId)}
        copy={copy.recentMatches}
        lang={lang}
        match={selectedRecentMatch}
        detail={recentMatchDetail}
        loading={recentMatchDetailLoading}
        error={recentMatchDetailError}
        onClose={handleCloseRecentMatchDetail}
        onRetry={handleRetryRecentMatchDetail}
      />
    </div>
  );
}

export default App;

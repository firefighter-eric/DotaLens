import { useEffect, useMemo, useState } from 'react';
import StatCard from './components/StatCard.jsx';
import WinRateTrend from './components/WinRateTrend.jsx';
import HeroPerformanceTable from './components/HeroPerformanceTable.jsx';
import RankDistribution from './components/RankDistribution.jsx';
import { dailyWinRate, heroPerformance, rankDistribution } from './data/mockDotaData.js';
import { summarizeDashboard } from './utils/metrics.js';
import { fetchPlayerWindowAnalytics } from './services/opendota.js';
import { getCopy } from './i18n/copy.js';

const MAX_UINT32 = 4294967295n;
const DEFAULT_STEAM32_ID = '898754153';

const createMockDashboard = (copy) => {
  const metrics = summarizeDashboard(heroPerformance);
  return {
    source: 'mock',
    playerName: copy.misc.samplePlayerName,
    totalMatches: metrics.totalMatches,
    heroPerformance,
    dailyWinRate,
    rankDistribution,
    metrics,
  };
};

const parseOpenDotaId = (value, copy) => {
  if (!/^\d+$/.test(value)) {
    return {
      valid: false,
      message: copy.errors.openDotaNumeric,
    };
  }

  return {
    valid: true,
    accountId: value,
  };
};

const parseSteam32 = (value, copy) => {
  if (!/^\d+$/.test(value)) {
    return {
      valid: false,
      message: copy.errors.steamNumeric,
    };
  }

  try {
    const steam32 = BigInt(value);
    if (steam32 <= 0n || steam32 > MAX_UINT32) {
      return {
        valid: false,
        message: copy.errors.steamInvalid,
      };
    }

    return {
      valid: true,
      accountId: steam32.toString(),
    };
  } catch {
    return {
      valid: false,
      message: copy.errors.steamInvalid,
    };
  }
};

function App() {
  const [lang, setLang] = useState('zh');
  const copy = useMemo(() => getCopy(lang), [lang]);

  const [inputAccountId, setInputAccountId] = useState(DEFAULT_STEAM32_ID);
  const [inputIdType, setInputIdType] = useState('steam');
  const [queryAccountId, setQueryAccountId] = useState(DEFAULT_STEAM32_ID);
  const [queryRawId, setQueryRawId] = useState(DEFAULT_STEAM32_ID);
  const [queryIdType, setQueryIdType] = useState('steam');
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(14);
  const [dashboard, setDashboard] = useState(() => createMockDashboard(getCopy('zh')));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  useEffect(() => {
    if (dashboard.source === 'mock') {
      setDashboard(createMockDashboard(copy));
    }
  }, [copy, dashboard.source]);

  useEffect(() => {
    if (!queryAccountId) {
      return undefined;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPlayerWindowAnalytics(queryAccountId, days, controller.signal, lang);
        setDashboard({
          ...data,
          source: 'opendota',
        });
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message || copy.errors.fetchFailed);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [queryAccountId, days, reloadKey, lang, copy.errors.fetchFailed]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedId = inputAccountId.trim();

    const parseResult =
      inputIdType === 'opendota' ? parseOpenDotaId(normalizedId, copy) : parseSteam32(normalizedId, copy);
    if (!parseResult.valid) {
      setError(parseResult.message);
      return;
    }

    const { accountId } = parseResult;
    setError('');
    if (accountId === queryAccountId && queryRawId === normalizedId && queryIdType === inputIdType) {
      setReloadKey((value) => value + 1);
      return;
    }
    setQueryAccountId(accountId);
    setQueryRawId(normalizedId);
    setQueryIdType(inputIdType);
  };

  const statusLine = error
    ? error
    : queryAccountId
      ? queryIdType === 'steam'
        ? copy.status.steam({
            playerName: dashboard.playerName,
            rawId: queryRawId,
            days,
            totalMatches: dashboard.totalMatches,
          })
        : copy.status.opendota({
            playerName: dashboard.playerName,
            accountId: queryAccountId,
            days,
            totalMatches: dashboard.totalMatches,
          })
      : copy.status.mock;

  const bestHero = dashboard.metrics.bestHero;

  return (
    <div className="app-shell">
      <header className="hero-header">
        <div className="hero-header__content">
          <div className="hero-top">
            <p className="eyebrow">{copy.app.eyebrow}</p>
            <div className="language-switch" role="group" aria-label={copy.app.languageLabel}>
              <button
                type="button"
                className={lang === 'zh' ? 'is-active' : ''}
                onClick={() => setLang('zh')}
                disabled={loading}
              >
                {copy.app.languages.zh}
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'is-active' : ''}
                onClick={() => setLang('en')}
                disabled={loading}
              >
                {copy.app.languages.en}
              </button>
            </div>
          </div>

          <h1>{copy.app.title}</h1>
          <p className="description">{copy.app.description}</p>

          <section className="query-panel">
            <form className="query-form" onSubmit={handleSubmit}>
              <label htmlFor="account-id-input">{copy.query.idTypeLabel}</label>
              <div className="id-type-switch" role="group" aria-label={copy.query.idTypeLabel}>
                <button
                  type="button"
                  className={inputIdType === 'steam' ? 'is-active' : ''}
                  onClick={() => setInputIdType('steam')}
                  disabled={loading}
                >
                  {copy.query.idTypes.steam}
                </button>
                <button
                  type="button"
                  className={inputIdType === 'opendota' ? 'is-active' : ''}
                  onClick={() => setInputIdType('opendota')}
                  disabled={loading}
                >
                  {copy.query.idTypes.opendota}
                </button>
              </div>
              <div className="query-controls">
                <input
                  id="account-id-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={copy.query.placeholders[inputIdType]}
                  value={inputAccountId}
                  onChange={(event) => setInputAccountId(event.target.value)}
                />
                <button type="submit" disabled={loading}>
                  {loading ? copy.query.loading : copy.query.submit}
                </button>
              </div>
              <p className="id-hint">{copy.query.hints[inputIdType]}</p>
              <div className="range-switch" role="group" aria-label={copy.query.rangeAriaLabel}>
                <button
                  type="button"
                  className={days === 14 ? 'is-active' : ''}
                  onClick={() => setDays(14)}
                  disabled={loading}
                >
                  {copy.query.day14}
                </button>
                <button
                  type="button"
                  className={days === 30 ? 'is-active' : ''}
                  onClick={() => setDays(30)}
                  disabled={loading}
                >
                  {copy.query.day30}
                </button>
              </div>
            </form>
            <p className={`status-line ${error ? 'is-error' : ''}`}>{statusLine}</p>
          </section>
        </div>
      </header>

      <main className="dashboard">
        <section className="stats-grid">
          <StatCard
            label={copy.cards.totalMatches}
            value={dashboard.metrics.totalMatches}
            subtext={copy.cards.totalMatchesSubtext(days)}
            accent="gold"
          />
          <StatCard
            label={copy.cards.overallWinRate}
            value={`${dashboard.metrics.overallWinRate}%`}
            subtext={copy.cards.overallWinRateSubtext}
            accent="teal"
          />
          <StatCard
            label={copy.cards.avgKda}
            value={dashboard.metrics.avgKda}
            subtext={copy.cards.avgKdaSubtext}
            accent="red"
          />
          <StatCard
            label={copy.cards.bestHero}
            value={bestHero.hero}
            subtext={copy.cards.bestHeroSubtext({ impact: bestHero.impact, avgGpm: bestHero.avgGpm })}
            accent="blue"
          />
        </section>

        <section className="two-cols">
          <WinRateTrend data={dashboard.dailyWinRate} days={days} copy={copy.trend} />
          <RankDistribution items={dashboard.rankDistribution} days={days} copy={copy.rank} />
        </section>

        <HeroPerformanceTable heroes={dashboard.heroPerformance} copy={copy.table} />
      </main>
    </div>
  );
}

export default App;

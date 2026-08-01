import { useEffect, useId, useMemo, useState } from 'react';
import { toValidUnixDate } from '../utils/date.js';

const fallbackCopy = {
  title: '队友协同',
  tag: () => '全历史样本',
  openHint: '按同队场次降序',
  noDataText: '暂无可用队友数据。',
  retry: '重试',
  retryAfter: (seconds) => `${seconds} 秒后重试`,
  tableAriaLabel: '队友协同数据表',
  sortColumn: (column) => `按${column}排序`,
  controls: {
    sortLabel: '排序字段',
    sortDirectionLabel: '排序方向',
    sortOptions: {
      matches: '场次',
      winRate: '胜率',
      avgGpm: 'GPM',
      avgXpm: 'XPM',
      againstWinRate: '对位胜率',
      lastPlayed: '最近遇到',
      teammate: '队友',
    },
    directionOptions: {
      desc: '降序',
      asc: '升序',
    },
  },
  summary: {
    teammateCount: '队友数',
    sharedMatches: '同队总场次',
    weightedWinRate: '加权胜率',
    againstMatches: '对位总场次',
  },
  headers: {
    teammate: '队友',
    matches: '场次',
    winRate: '胜率',
    record: '战绩',
    gpmXpm: 'GPM / XPM',
    againstWinRate: '对位胜率',
    lastPlayed: '最近遇到时间',
  },
  againstNoData: '-',
  emptyValue: '-',
};

const TEAMMATE_SORT_KEYS = [
  'matches',
  'winRate',
  'record',
  'gpmXpm',
  'avgGpm',
  'avgXpm',
  'againstRecord',
  'againstWinRate',
  'lastPlayed',
  'teammate',
];

const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value, locale, fallback) => {
  const number = toFiniteOrNull(value);
  if (number === null) {
    return fallback;
  }
  return new Intl.NumberFormat(locale).format(number);
};

const formatPercent = (value, fallback) => {
  const number = toFiniteOrNull(value);
  if (number === null) {
    return fallback;
  }
  return `${number.toFixed(1)}%`;
};

const formatRecord = (wins, matches, locale, fallback) => {
  const safeMatches = toFiniteOrNull(matches);
  if (safeMatches === null || safeMatches <= 0) {
    return fallback;
  }
  const safeWins = Math.max(0, toFiniteOrNull(wins) ?? 0);
  return `${new Intl.NumberFormat(locale).format(safeWins)}/${new Intl.NumberFormat(locale).format(safeMatches)}`;
};

const formatDateTime = (unixSec, locale, fallback) => {
  const date = toValidUnixDate(unixSec);
  if (!date) {
    return fallback;
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const compareTeammates = (a, b, sortKey, sortDir, locale) => {
  const factor = sortDir === 'asc' ? 1 : -1;
  if (sortKey === 'teammate') {
    const base = String(a?.playerName ?? '').localeCompare(String(b?.playerName ?? ''), locale);
    return base * factor;
  }

  const resolveSortValue = (entry) => {
    if (sortKey === 'gpmXpm') {
      return toFiniteOrNull(entry?.avgGpm);
    }
    if (sortKey === 'record') {
      return toFiniteOrNull(entry?.wins);
    }
    if (sortKey === 'againstRecord') {
      return toFiniteOrNull(entry?.againstMatches);
    }
    return toFiniteOrNull(entry?.[sortKey]);
  };
  const av = resolveSortValue(a);
  const bv = resolveSortValue(b);

  if (av === null && bv === null) {
    return String(a?.playerName ?? '').localeCompare(String(b?.playerName ?? ''), locale);
  }
  if (av === null) {
    return 1;
  }
  if (bv === null) {
    return -1;
  }
  if (av !== bv) {
    return (av - bv) * factor;
  }
  if (sortKey === 'gpmXpm') {
    const avXpm = toFiniteOrNull(a?.avgXpm) ?? -1;
    const bvXpm = toFiniteOrNull(b?.avgXpm) ?? -1;
    if (avXpm !== bvXpm) {
      return (avXpm - bvXpm) * factor;
    }
  }
  if (sortKey === 'againstRecord') {
    const avWins = toFiniteOrNull(a?.againstWins) ?? -1;
    const bvWins = toFiniteOrNull(b?.againstWins) ?? -1;
    if (avWins !== bvWins) {
      return (avWins - bvWins) * factor;
    }
  }
  return String(a?.playerName ?? '').localeCompare(String(b?.playerName ?? ''), locale);
};

function TeammatesPanel({
  teammates = [],
  days = 30,
  lang = 'zh',
  copy = fallbackCopy,
  error = '',
  errorRetryable = true,
  retryAfter = null,
  onRetry,
  scope = 'public-history',
}) {
  const titleId = useId();
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const [sortKey, setSortKey] = useState('matches');
  const [sortDir, setSortDir] = useState('desc');
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0);
  useEffect(() => {
    const delay = Number(retryAfter);
    if (!error || !Number.isFinite(delay) || delay <= 0) {
      setRetryDelaySeconds(0);
      return undefined;
    }
    setRetryDelaySeconds(Math.ceil(delay));
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
  }, [error, retryAfter]);
  const toggleSort = (nextKey) => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === 'teammate' ? 'asc' : 'desc');
  };
  const renderSortIndicator = (key) => {
    if (sortKey !== key) {
      return null;
    }
    return (
      <span className="sort-indicator" aria-hidden="true">
        {sortDir === 'desc' ? '↓' : '↑'}
      </span>
    );
  };
  const resolveAriaSort = (key) => {
    if (sortKey !== key) {
      return 'none';
    }
    return sortDir === 'desc' ? 'descending' : 'ascending';
  };
  const resolveSortLabel = (label) =>
    typeof copy.sortColumn === 'function' ? copy.sortColumn(label) : fallbackCopy.sortColumn(label);
  const sortedTeammates = useMemo(
    () => teammates.slice().sort((a, b) => compareTeammates(a, b, sortKey, sortDir, locale)),
    [teammates, sortKey, sortDir, locale]
  );
  const totalTeammates = teammates.length;
  const totalSharedMatches = teammates.reduce((sum, entry) => sum + (toFiniteOrNull(entry?.matches) ?? 0), 0);
  const totalAgainstMatches = teammates.reduce((sum, entry) => sum + (toFiniteOrNull(entry?.againstMatches) ?? 0), 0);
  const totalWins = teammates.reduce((sum, entry) => sum + (toFiniteOrNull(entry?.wins) ?? 0), 0);
  const weightedWinRate = totalSharedMatches > 0 ? (totalWins / totalSharedMatches) * 100 : null;
  const controlCopy = copy.controls ?? fallbackCopy.controls;
  const sortOptions = {
    ...fallbackCopy.controls.sortOptions,
    ...(controlCopy.sortOptions ?? {}),
    record: copy.headers?.record ?? fallbackCopy.headers.record,
    gpmXpm: copy.headers?.gpmXpm ?? fallbackCopy.headers.gpmXpm,
    againstRecord:
      copy.headers?.againstWinRate ?? fallbackCopy.headers.againstWinRate,
  };
  const directionOptions = {
    ...fallbackCopy.controls.directionOptions,
    ...(controlCopy.directionOptions ?? {}),
  };
  const retryWaiting = errorRetryable && retryDelaySeconds > 0;
  const retryText =
    retryWaiting && typeof copy.retryAfter === 'function'
      ? copy.retryAfter(retryDelaySeconds)
      : copy.retry || fallbackCopy.retry;

  return (
    <section className="panel table-panel" aria-labelledby={titleId} data-scope={scope}>
      <div className="panel-header">
        <h2 id={titleId}>{copy.title}</h2>
        <div className="recent-panel-actions">
          <span className="panel-tag">{copy.tag(days)}</span>
          <span className="panel-tag panel-tag--subtle">{copy.openHint || fallbackCopy.openHint}</span>
        </div>
      </div>

      {error ? (
        <div className="panel-state-row" role="alert">
          <p className="panel-state is-error">{error}</p>
          {onRetry && errorRetryable ? (
            <button
              type="button"
              className="panel-retry-btn"
              onClick={onRetry}
              disabled={retryWaiting}
            >
              {retryText}
            </button>
          ) : null}
        </div>
      ) : null}

      {teammates.length > 0 ? (
        <>
          <div className="table-controls mobile-sort-controls">
            <label>
              <span>{controlCopy.sortLabel}</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                {TEAMMATE_SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {sortOptions[key]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{controlCopy.sortDirectionLabel}</span>
              <select value={sortDir} onChange={(event) => setSortDir(event.target.value)}>
                <option value="desc">{directionOptions.desc}</option>
                <option value="asc">{directionOptions.asc}</option>
              </select>
            </label>
          </div>
          <div className="recent-summary-grid">
            <div className="recent-summary-item">
              <span>{copy.summary.teammateCount}</span>
              <strong>{totalTeammates}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.sharedMatches}</span>
              <strong>{formatNumber(totalSharedMatches, locale, copy.emptyValue)}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.weightedWinRate}</span>
              <strong>{formatPercent(weightedWinRate, copy.emptyValue)}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.againstMatches}</span>
              <strong>{formatNumber(totalAgainstMatches, locale, copy.emptyValue)}</strong>
            </div>
          </div>

          <div
            className="table-wrap recent-table-wrap desktop-data-table"
            role="region"
            aria-label={copy.tableAriaLabel || fallbackCopy.tableAriaLabel}
            tabIndex={0}
          >
            <table className="recent-table">
              <caption className="sr-only">{copy.tableAriaLabel || fallbackCopy.tableAriaLabel}</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={resolveAriaSort('teammate')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('teammate')}
                      aria-label={resolveSortLabel(copy.headers.teammate)}
                    >
                      {copy.headers.teammate}
                      {renderSortIndicator('teammate')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort('matches')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('matches')}
                      aria-label={resolveSortLabel(copy.headers.matches)}
                    >
                      {copy.headers.matches}
                      {renderSortIndicator('matches')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort('winRate')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('winRate')}
                      aria-label={resolveSortLabel(copy.headers.winRate)}
                    >
                      {copy.headers.winRate}
                      {renderSortIndicator('winRate')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort('record')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('record')}
                      aria-label={resolveSortLabel(copy.headers.record)}
                    >
                      {copy.headers.record}
                      {renderSortIndicator('record')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort('gpmXpm')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('gpmXpm')}
                      aria-label={resolveSortLabel(copy.headers.gpmXpm)}
                    >
                      {copy.headers.gpmXpm}
                      {renderSortIndicator('gpmXpm')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort('againstRecord')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('againstRecord')}
                      aria-label={resolveSortLabel(copy.headers.againstWinRate)}
                    >
                      {copy.headers.againstWinRate}
                      {renderSortIndicator('againstRecord')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort('lastPlayed')}>
                    <button
                      type="button"
                      className="sort-th-btn"
                      onClick={() => toggleSort('lastPlayed')}
                      aria-label={resolveSortLabel(copy.headers.lastPlayed)}
                    >
                      {copy.headers.lastPlayed}
                      {renderSortIndicator('lastPlayed')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTeammates.map((teammate) => (
                  <tr key={teammate.accountId ?? teammate.playerName}>
                    <td>
                      <div className="hero-name-cell">
                        {teammate.playerAvatar ? (
                          <img src={teammate.playerAvatar} alt="" className="teammate-avatar" loading="lazy" />
                        ) : null}
                        <span>{teammate.playerName || copy.emptyValue}</span>
                      </div>
                    </td>
                    <td>{formatNumber(teammate.matches, locale, copy.emptyValue)}</td>
                    <td>{formatPercent(teammate.winRate, copy.emptyValue)}</td>
                    <td>
                      {formatNumber(teammate.wins, locale, copy.emptyValue)} / {formatNumber(teammate.losses, locale, copy.emptyValue)}
                    </td>
                    <td>
                      {formatNumber(teammate.avgGpm, locale, copy.emptyValue)} / {formatNumber(teammate.avgXpm, locale, copy.emptyValue)}
                    </td>
                    <td>
                      {formatPercent(teammate.againstWinRate, copy.againstNoData || '-')} ·{' '}
                      {formatRecord(teammate.againstWins, teammate.againstMatches, locale, copy.againstNoData || '-')}
                    </td>
                    <td>{formatDateTime(teammate.lastPlayed, locale, copy.emptyValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="teammate-mobile-list" aria-label={copy.tableAriaLabel || fallbackCopy.tableAriaLabel}>
            {sortedTeammates.map((teammate) => (
              <article key={`mobile-${teammate.accountId ?? teammate.playerName}`} className="teammate-mobile-card">
                <div className="teammate-mobile-card__head">
                  <span className="hero-name-cell">
                    {teammate.playerAvatar ? (
                      <img src={teammate.playerAvatar} alt="" className="teammate-avatar" loading="lazy" />
                    ) : null}
                    <strong>{teammate.playerName || copy.emptyValue}</strong>
                  </span>
                  <strong>{formatPercent(teammate.winRate, copy.emptyValue)}</strong>
                </div>
                <dl className="teammate-mobile-card__metrics">
                  <div>
                    <dt>{copy.headers.matches}</dt>
                    <dd>{formatNumber(teammate.matches, locale, copy.emptyValue)}</dd>
                  </div>
                  <div>
                    <dt>{copy.headers.record}</dt>
                    <dd>
                      {formatNumber(teammate.wins, locale, copy.emptyValue)} /{' '}
                      {formatNumber(teammate.losses, locale, copy.emptyValue)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.headers.gpmXpm}</dt>
                    <dd>
                      {formatNumber(teammate.avgGpm, locale, copy.emptyValue)} /{' '}
                      {formatNumber(teammate.avgXpm, locale, copy.emptyValue)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.headers.againstWinRate}</dt>
                    <dd>{formatPercent(teammate.againstWinRate, copy.againstNoData || '-')}</dd>
                  </div>
                </dl>
                <p className="teammate-mobile-card__last-played">
                  <span>{copy.headers.lastPlayed}</span>
                  <strong>{formatDateTime(teammate.lastPlayed, locale, copy.emptyValue)}</strong>
                </p>
              </article>
            ))}
          </div>
        </>
      ) : !error ? (
        <p className="empty-text">{copy.noDataText}</p>
      ) : null}
    </section>
  );
}

export default TeammatesPanel;

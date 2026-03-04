import { useMemo, useState } from 'react';

const fallbackCopy = {
  title: '队友协同',
  tag: () => '全历史样本',
  openHint: '按同队场次降序',
  noDataText: '暂无可用队友数据。',
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

const toFiniteOrNull = (value) => {
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
  const value = toFiniteOrNull(unixSec);
  if (value === null || value <= 0) {
    return fallback;
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value * 1000));
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

function TeammatesPanel({ teammates = [], days = 30, lang = 'zh', copy = fallbackCopy }) {
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const [sortKey, setSortKey] = useState('matches');
  const [sortDir, setSortDir] = useState('desc');
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
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };
  const sortedTeammates = useMemo(
    () => teammates.slice().sort((a, b) => compareTeammates(a, b, sortKey, sortDir, locale)),
    [teammates, sortKey, sortDir, locale]
  );
  const totalTeammates = teammates.length;
  const totalSharedMatches = teammates.reduce((sum, entry) => sum + (toFiniteOrNull(entry?.matches) ?? 0), 0);
  const totalAgainstMatches = teammates.reduce((sum, entry) => sum + (toFiniteOrNull(entry?.againstMatches) ?? 0), 0);
  const totalWins = teammates.reduce((sum, entry) => sum + (toFiniteOrNull(entry?.wins) ?? 0), 0);
  const weightedWinRate = totalSharedMatches > 0 ? (totalWins / totalSharedMatches) * 100 : null;

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <div className="recent-panel-actions">
          <span className="panel-tag">{copy.tag(days)}</span>
          <span className="panel-tag panel-tag--subtle">{copy.openHint || fallbackCopy.openHint}</span>
        </div>
      </div>

      {teammates.length > 0 ? (
        <>
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

          <div className="table-wrap recent-table-wrap">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('teammate')}>
                      {copy.headers.teammate}
                      {renderSortIndicator('teammate')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('matches')}>
                      {copy.headers.matches}
                      {renderSortIndicator('matches')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('winRate')}>
                      {copy.headers.winRate}
                      {renderSortIndicator('winRate')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('record')}>
                      {copy.headers.record}
                      {renderSortIndicator('record')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('gpmXpm')}>
                      {copy.headers.gpmXpm}
                      {renderSortIndicator('gpmXpm')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('againstRecord')}>
                      {copy.headers.againstWinRate}
                      {renderSortIndicator('againstRecord')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-th-btn" onClick={() => toggleSort('lastPlayed')}>
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
                          <img src={teammate.playerAvatar} alt={teammate.playerName} className="teammate-avatar" loading="lazy" />
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
                    <td>{formatRecord(teammate.againstWins, teammate.againstMatches, locale, '-')}</td>
                    <td>{formatDateTime(teammate.lastPlayed, locale, copy.emptyValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="empty-text">{copy.noDataText}</p>
      )}
    </section>
  );
}

export default TeammatesPanel;

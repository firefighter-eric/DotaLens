import { toPercent } from '../utils/metrics.js';

const fallbackCopy = {
  title: '英雄表现对比',
  tag: '支持排序/筛选/导出',
  openHint: '点击英雄行展开该英雄在当前窗口的比赛',
  headers: {
    hero: '英雄',
    attribute: '属性',
    matches: '场次',
    winRate: '胜率',
    avgKda: '平均 KDA',
    avgGpm: '平均 GPM',
    avgXpm: '平均 XPM',
    impact: '影响力',
  },
  controls: {
    sortLabel: '排序字段',
    sortDirectionLabel: '排序方向',
    attributeLabel: '属性筛选',
    minMatchesLabel: '最少场次',
    export: '导出 CSV',
    attributeAll: '全部属性',
    sortOptions: {
      impact: '影响力',
      attribute: '属性',
      matches: '场次',
      winRate: '胜率',
      avgKda: '平均 KDA',
      avgGpm: '平均 GPM',
      avgXpm: '平均 XPM',
      hero: '英雄名',
    },
    directionOptions: {
      desc: '降序',
      asc: '升序',
    },
    resultCount: (count) => `共 ${count} 个英雄`,
  },
  heroMatchesEmpty: '该英雄暂无可展示的比赛明细。',
  empty: '当前筛选条件下没有英雄统计数据。',
};

const fallbackRecentCopy = {
  headers: {
    date: '时间',
    result: '结果',
    kda: 'K/D/A',
    gpmXpm: 'GPM / XPM',
    heroDamage: '英雄伤害',
    duration: '时长',
    rank: '段位',
    matchId: '比赛 ID',
  },
  result: {
    win: '胜利',
    loss: '失败',
  },
  timeTags: {
    today: '今天',
    yesterday: '昨天',
    within3Days: '3天内',
    within7Days: '7天内',
    within30Days: '30天内',
  },
  emptyValue: '-',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTRIBUTE_TONE_MAP = {
  str: 'strength',
  strength: 'strength',
  力量: 'strength',
  agi: 'agility',
  agility: 'agility',
  敏捷: 'agility',
  int: 'intelligence',
  intelligence: 'intelligence',
  智力: 'intelligence',
  all: 'universal',
  universal: 'universal',
  全才: 'universal',
};

const resolveAttributeTone = (attribute) => {
  if (typeof attribute !== 'string') {
    return 'unknown';
  }

  const normalized = attribute.trim().toLowerCase();
  return ATTRIBUTE_TONE_MAP[normalized] ?? 'unknown';
};

const formatDateTime = (startTime, locale, fallback) => {
  if (!startTime) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(startTime * 1000));
};

const formatDuration = (durationSec, fallback) => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return fallback;
  }
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatNumber = (value, locale, fallback) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return new Intl.NumberFormat(locale).format(value);
};

const getDayStartMs = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const resolveMatchTimeTag = (startTime, boundaries, labels) => {
  if (!startTime || !labels) {
    return null;
  }

  const startMs = startTime * 1000;
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const matchDayStartMs = getDayStartMs(new Date(startMs));
  const diffDays = Math.floor((boundaries.todayStartMs - matchDayStartMs) / DAY_MS);
  if (!Number.isFinite(diffDays) || diffDays < 0) {
    return null;
  }
  if (matchDayStartMs === boundaries.todayStartMs) {
    return { key: 'today', label: labels.today };
  }
  if (matchDayStartMs === boundaries.yesterdayStartMs) {
    return { key: 'yesterday', label: labels.yesterday };
  }
  if (diffDays <= 3) {
    return { key: 'within3Days', label: labels.within3Days };
  }
  if (diffDays <= 7) {
    return { key: 'within7Days', label: labels.within7Days };
  }
  if (diffDays <= 30) {
    return { key: 'within30Days', label: labels.within30Days };
  }

  return null;
};

function HeroPerformanceTable({
  heroes,
  attributes = [],
  controls,
  onSortKeyChange,
  onSortDirChange,
  onAttributeFilterChange,
  onMinMatchesChange,
  onExport,
  heroMatchesMap = new Map(),
  selectedHeroId = null,
  onSelectHero,
  selectedMatchId = null,
  onSelectMatch,
  recentCopy = fallbackRecentCopy,
  lang = 'zh',
  copy = fallbackCopy,
}) {
  const activeControls = controls ?? {
    sortKey: 'winRate',
    sortDir: 'desc',
    attributeFilter: 'all',
    minMatches: 2,
  };
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const effectiveRecentCopy = {
    ...fallbackRecentCopy,
    ...recentCopy,
    headers: {
      ...fallbackRecentCopy.headers,
      ...(recentCopy?.headers ?? {}),
    },
    result: {
      ...fallbackRecentCopy.result,
      ...(recentCopy?.result ?? {}),
    },
    timeTags: {
      ...fallbackRecentCopy.timeTags,
      ...(recentCopy?.timeTags ?? {}),
    },
  };
  const now = new Date();
  const timeBoundaries = {
    todayStartMs: getDayStartMs(now),
    yesterdayStartMs: getDayStartMs(now) - DAY_MS,
  };
  const toggleSort = (nextKey) => {
    if (activeControls.sortKey === nextKey) {
      onSortDirChange?.(activeControls.sortDir === 'desc' ? 'asc' : 'desc');
      return;
    }
    onSortKeyChange?.(nextKey);
    onSortDirChange?.(nextKey === 'hero' || nextKey === 'attribute' ? 'asc' : 'desc');
  };
  const renderSortIndicator = (key) => {
    if (activeControls.sortKey !== key) {
      return null;
    }
    return activeControls.sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <div className="recent-panel-actions">
          <span className="panel-tag">{copy.controls.resultCount(heroes.length)}</span>
          <span className="panel-tag panel-tag--subtle">{copy.openHint || fallbackCopy.openHint}</span>
        </div>
      </div>
      <div className="table-controls" role="group" aria-label={copy.title}>
        <label>
          <span>{copy.controls.attributeLabel}</span>
          <select
            value={activeControls.attributeFilter}
            onChange={(event) => onAttributeFilterChange?.(event.target.value)}
          >
            <option value="all">{copy.controls.attributeAll}</option>
            {attributes.map((attribute) => (
              <option key={attribute} value={attribute}>
                {attribute}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.controls.minMatchesLabel}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={activeControls.minMatches}
            onChange={(event) => onMinMatchesChange?.(event.target.value)}
          />
        </label>
        <button type="button" className="table-export-btn" onClick={onExport} disabled={heroes.length === 0}>
          {copy.controls.export}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('hero')}>
                  {copy.headers.hero}
                  {renderSortIndicator('hero')}
                </button>
              </th>
              <th>
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('attribute')}>
                  {copy.headers.attribute}
                  {renderSortIndicator('attribute')}
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
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('avgKda')}>
                  {copy.headers.avgKda}
                  {renderSortIndicator('avgKda')}
                </button>
              </th>
              <th>
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('avgGpm')}>
                  {copy.headers.avgGpm}
                  {renderSortIndicator('avgGpm')}
                </button>
              </th>
              <th>
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('avgXpm')}>
                  {copy.headers.avgXpm}
                  {renderSortIndicator('avgXpm')}
                </button>
              </th>
              <th>
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('impact')}>
                  {copy.headers.impact}
                  {renderSortIndicator('impact')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {heroes.length > 0 ? (
              heroes.map((hero) => {
                const rowId = hero.heroId ?? hero.hero;
                const isSelected = selectedHeroId === rowId;
                const winRate = `${toPercent(hero.wins, hero.matches)}%`;
                const avgGpm = Number.isFinite(hero.avgGpm) ? hero.avgGpm : '-';
                const avgXpm = Number.isFinite(hero.avgXpm) ? hero.avgXpm : '-';
                const heroMatches = heroMatchesMap.get(rowId) ?? [];
                const attributeTone = resolveAttributeTone(hero.attribute);
                const attributeLabel = hero.attribute || '-';

                return [
                  <tr
                    key={`hero-row-${rowId}`}
                    className={`hero-row ${isSelected ? 'is-selected' : ''}`}
                    tabIndex={0}
                    onClick={() => onSelectHero?.(hero)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectHero?.(hero);
                      }
                    }}
                  >
                    <td>
                      <div className="hero-name-cell">
                        {hero.heroAvatar ? <img src={hero.heroAvatar} alt={hero.hero} className="hero-avatar" loading="lazy" /> : null}
                        <span>{hero.hero}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`attribute-tag is-${attributeTone}`}>{attributeLabel}</span>
                    </td>
                    <td>{hero.matches}</td>
                    <td>{winRate}</td>
                    <td>{hero.avgKda}</td>
                    <td>{avgGpm}</td>
                    <td>{avgXpm}</td>
                    <td>
                      <div className="impact-cell">
                        <span>{hero.impact}</span>
                        <div className="impact-bar">
                          <i style={{ width: `${hero.impact}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>,
                  isSelected ? (
                    <tr key={`hero-row-detail-${rowId}`} className="hero-row-detail">
                      <td colSpan={8}>
                        {heroMatches.length > 0 ? (
                          <div className="hero-match-table-wrap">
                            <table className="hero-match-table">
                              <thead>
                                <tr>
                                  <th>{effectiveRecentCopy.headers.date}</th>
                                  <th>{effectiveRecentCopy.headers.result}</th>
                                  <th>{effectiveRecentCopy.headers.kda}</th>
                                  <th>{effectiveRecentCopy.headers.gpmXpm}</th>
                                  <th>{effectiveRecentCopy.headers.heroDamage}</th>
                                  <th>{effectiveRecentCopy.headers.duration}</th>
                                  <th>{effectiveRecentCopy.headers.rank}</th>
                                  <th>{effectiveRecentCopy.headers.matchId}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {heroMatches.map((match) => {
                                  const kdaValue = Number.isFinite(match.kda) ? match.kda.toFixed(2) : effectiveRecentCopy.emptyValue;
                                  const gpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : effectiveRecentCopy.emptyValue;
                                  const xpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : effectiveRecentCopy.emptyValue;
                                  const heroDamage = formatNumber(match.heroDamage, locale, effectiveRecentCopy.emptyValue);
                                  const rowClassName = `recent-row ${selectedMatchId === match.matchId ? 'is-selected' : ''}`;
                                  const timeTag = resolveMatchTimeTag(match.startTime, timeBoundaries, effectiveRecentCopy.timeTags);

                                  return (
                                    <tr
                                      key={match.matchId}
                                      className={rowClassName}
                                      tabIndex={0}
                                      onClick={() => onSelectMatch?.(match)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          onSelectMatch?.(match);
                                        }
                                      }}
                                    >
                                      <td>
                                        <div className="recent-date-cell">
                                          <span>{formatDateTime(match.startTime, locale, effectiveRecentCopy.emptyValue)}</span>
                                          {timeTag ? <span className={`recent-time-tag is-${timeTag.key}`}>{timeTag.label}</span> : null}
                                        </div>
                                      </td>
                                      <td>
                                        <span className={`result-pill ${match.result === 'win' ? 'is-win' : 'is-loss'}`}>
                                          {effectiveRecentCopy.result[match.result] ?? effectiveRecentCopy.emptyValue}
                                        </span>
                                      </td>
                                      <td>
                                        {match.kills}/{match.deaths}/{match.assists} ({kdaValue})
                                      </td>
                                      <td>
                                        {gpm} / {xpm}
                                      </td>
                                      <td>{heroDamage}</td>
                                      <td>{formatDuration(match.durationSec, effectiveRecentCopy.emptyValue)}</td>
                                      <td>{match.rank || effectiveRecentCopy.emptyValue}</td>
                                      <td>{match.matchId}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="empty-text hero-match-empty">{copy.heroMatchesEmpty ?? fallbackCopy.heroMatchesEmpty}</p>
                        )}
                      </td>
                    </tr>
                  ) : null,
                ];
              })
            ) : (
              <tr>
                <td colSpan={8} className="empty-cell">
                  {copy.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default HeroPerformanceTable;

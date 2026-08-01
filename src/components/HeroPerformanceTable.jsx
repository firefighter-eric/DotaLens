import { useId } from 'react';
import { formatHeroWinRate } from '../utils/metrics.js';
import { differenceInLocalCalendarDays, toValidUnixDate } from '../utils/date.js';

const fallbackCopy = {
  title: '英雄表现对比',
  tag: '支持排序/筛选/导出',
  openHint: '使用英雄名称按钮展开当前窗口的比赛',
  tableAriaLabel: '英雄表现数据表',
  heroMatchesTableAriaLabel: (hero) => `${hero}比赛明细`,
  expandHero: (hero) => `展开 ${hero} 比赛明细`,
  collapseHero: (hero) => `收起 ${hero} 比赛明细`,
  sortColumn: (column) => `按${column}排序`,
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
  unknownOutcomeMatches: (count) => `${count} 场结果未知，胜率未计入`,
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
    rank: '局内平均段位 / 技能组',
    matchId: '比赛 ID',
  },
  rankKinds: {
    matchAverageRank: '局内平均段位',
    skillBracket: '技能组',
    playerRank: '玩家段位',
    unknown: '段位来源未知',
  },
  rankAriaLabel: ({ value, kind }) => `${kind}：${value}`,
  result: {
    win: '胜利',
    loss: '失败',
    unknown: '未知',
  },
  openMatch: '查看',
  openMatchAriaLabel: ({ hero, result, date }) => `查看 ${date} ${hero} ${result}的比赛详情`,
  tableAriaLabel: '比赛明细数据表',
  timeTags: {
    today: '今天',
    yesterday: '昨天',
    within3Days: '3天内',
    within7Days: '7天内',
    within30Days: '30天内',
  },
  emptyValue: '-',
};

const HERO_SORT_KEYS = [
  'impact',
  'attribute',
  'matches',
  'winRate',
  'avgKda',
  'avgGpm',
  'avgXpm',
  'hero',
];

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
  const date = toValidUnixDate(startTime);
  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
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

const formatKdaLine = (match, fallback) => {
  const part = (value) => (Number.isFinite(value) ? value : fallback);
  const kda = Number.isFinite(match.kda) ? match.kda.toFixed(2) : fallback;
  return `${part(match.kills)}/${part(match.deaths)}/${part(match.assists)} (${kda})`;
};

const getRankPresentation = (match, copy) => {
  const value = match.rank || copy.emptyValue;
  const rankKinds = copy.rankKinds || fallbackRecentCopy.rankKinds;
  const kind = rankKinds[match.rankKind] || rankKinds.unknown;
  const ariaLabel =
    typeof copy.rankAriaLabel === 'function'
      ? copy.rankAriaLabel({ value, kind })
      : fallbackRecentCopy.rankAriaLabel({ value, kind });
  return { value, kind, ariaLabel };
};

const getResultTone = (result) => {
  if (result === 'win') {
    return 'is-win';
  }
  if (result === 'loss') {
    return 'is-loss';
  }
  return 'is-unknown';
};

const resolveMatchTimeTag = (startTime, boundaries, labels) => {
  const startDate = toValidUnixDate(startTime);
  if (!startDate || !labels) {
    return null;
  }

  const startMs = startDate.getTime();
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const diffDays = differenceInLocalCalendarDays(
    boundaries.today,
    new Date(startMs)
  );
  if (!Number.isFinite(diffDays) || diffDays < 0) {
    return null;
  }
  if (diffDays === 0) {
    return { key: 'today', label: labels.today };
  }
  if (diffDays === 1) {
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
  const titleId = useId();
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
      ...(lang === 'en'
        ? {
            today: 'Today',
            yesterday: 'Yesterday',
            within3Days: 'Within 3 Days',
            within7Days: 'Within 7 Days',
            within30Days: 'Within 30 Days',
          }
        : fallbackRecentCopy.timeTags),
      ...(recentCopy?.timeTags ?? {}),
    },
  };
  const timeBoundaries = { today: new Date() };
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
    return (
      <span aria-hidden="true" className="sort-indicator">
        {activeControls.sortDir === 'desc' ? '↓' : '↑'}
      </span>
    );
  };
  const resolveAriaSort = (key) => {
    if (activeControls.sortKey !== key) {
      return 'none';
    }
    return activeControls.sortDir === 'desc' ? 'descending' : 'ascending';
  };
  const resolveSortLabel = (key) => {
    const label = copy.headers[key];
    return typeof copy.sortColumn === 'function' ? copy.sortColumn(label) : fallbackCopy.sortColumn(label);
  };
  const controlCopy = copy.controls ?? fallbackCopy.controls;
  const sortOptions = {
    ...fallbackCopy.controls.sortOptions,
    ...(controlCopy.sortOptions ?? {}),
  };
  const directionOptions = {
    ...fallbackCopy.controls.directionOptions,
    ...(controlCopy.directionOptions ?? {}),
  };

  return (
    <section className="panel table-panel" aria-labelledby={titleId}>
      <div className="panel-header">
        <h2 id={titleId}>{copy.title}</h2>
        <div className="recent-panel-actions">
          <span className="panel-tag" role="status" aria-live="polite">
            {copy.controls.resultCount(heroes.length)}
          </span>
          <span className="panel-tag panel-tag--subtle">{copy.openHint || fallbackCopy.openHint}</span>
        </div>
      </div>
      <div className="table-controls" role="group" aria-label={copy.title}>
        <div className="mobile-sort-controls">
          <label>
            <span>{controlCopy.sortLabel}</span>
            <select
              value={activeControls.sortKey}
              onChange={(event) => onSortKeyChange?.(event.target.value)}
            >
              {HERO_SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {sortOptions[key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{controlCopy.sortDirectionLabel}</span>
            <select
              value={activeControls.sortDir}
              onChange={(event) => onSortDirChange?.(event.target.value)}
            >
              <option value="desc">{directionOptions.desc}</option>
              <option value="asc">{directionOptions.asc}</option>
            </select>
          </label>
        </div>
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
      <div
        className="table-wrap desktop-data-table"
        role="region"
        aria-label={copy.tableAriaLabel || fallbackCopy.tableAriaLabel}
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">{copy.tableAriaLabel || fallbackCopy.tableAriaLabel}</caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={resolveAriaSort('hero')}>
                <button type="button" className="sort-th-btn" onClick={() => toggleSort('hero')} aria-label={resolveSortLabel('hero')}>
                  {copy.headers.hero}
                  {renderSortIndicator('hero')}
                </button>
              </th>
              <th scope="col" aria-sort={resolveAriaSort('attribute')}>
                <button
                  type="button"
                  className="sort-th-btn"
                  onClick={() => toggleSort('attribute')}
                  aria-label={resolveSortLabel('attribute')}
                >
                  {copy.headers.attribute}
                  {renderSortIndicator('attribute')}
                </button>
              </th>
              <th scope="col" aria-sort={resolveAriaSort('matches')}>
                <button
                  type="button"
                  className="sort-th-btn"
                  onClick={() => toggleSort('matches')}
                  aria-label={resolveSortLabel('matches')}
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
                  aria-label={resolveSortLabel('winRate')}
                >
                  {copy.headers.winRate}
                  {renderSortIndicator('winRate')}
                </button>
              </th>
              <th scope="col" aria-sort={resolveAriaSort('avgKda')}>
                <button
                  type="button"
                  className="sort-th-btn"
                  onClick={() => toggleSort('avgKda')}
                  aria-label={resolveSortLabel('avgKda')}
                >
                  {copy.headers.avgKda}
                  {renderSortIndicator('avgKda')}
                </button>
              </th>
              <th scope="col" aria-sort={resolveAriaSort('avgGpm')}>
                <button
                  type="button"
                  className="sort-th-btn"
                  onClick={() => toggleSort('avgGpm')}
                  aria-label={resolveSortLabel('avgGpm')}
                >
                  {copy.headers.avgGpm}
                  {renderSortIndicator('avgGpm')}
                </button>
              </th>
              <th scope="col" aria-sort={resolveAriaSort('avgXpm')}>
                <button
                  type="button"
                  className="sort-th-btn"
                  onClick={() => toggleSort('avgXpm')}
                  aria-label={resolveSortLabel('avgXpm')}
                >
                  {copy.headers.avgXpm}
                  {renderSortIndicator('avgXpm')}
                </button>
              </th>
              <th scope="col" aria-sort={resolveAriaSort('impact')}>
                <button
                  type="button"
                  className="sort-th-btn"
                  onClick={() => toggleSort('impact')}
                  aria-label={resolveSortLabel('impact')}
                >
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
                const winRate = formatHeroWinRate(hero, effectiveRecentCopy.emptyValue);
                const impact = Number.isFinite(hero.impact)
                  ? hero.impact
                  : effectiveRecentCopy.emptyValue;
                const unknownOutcomeMatches = Number.isFinite(hero.unknownOutcomeMatches)
                  ? Math.max(0, hero.unknownOutcomeMatches)
                  : Number.isFinite(hero.unknownOutcomes)
                    ? Math.max(0, hero.unknownOutcomes)
                    : Math.max(0, (hero.matches ?? 0) - (hero.outcomeMatches ?? hero.matches ?? 0));
                const unknownOutcomeLabel =
                  typeof copy.unknownOutcomeMatches === 'function'
                    ? copy.unknownOutcomeMatches(unknownOutcomeMatches)
                    : fallbackCopy.unknownOutcomeMatches(unknownOutcomeMatches);
                const avgGpm = Number.isFinite(hero.avgGpm) ? hero.avgGpm : '-';
                const avgXpm = Number.isFinite(hero.avgXpm) ? hero.avgXpm : '-';
                const avgKda = Number.isFinite(hero.avgKda) ? hero.avgKda : '-';
                const heroMatches = heroMatchesMap.get(rowId) ?? [];
                const attributeTone = resolveAttributeTone(hero.attribute);
                const attributeLabel = hero.attribute || '-';
                const detailId = `hero-detail-${String(rowId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                const expandLabel =
                  typeof copy.expandHero === 'function' ? copy.expandHero(hero.hero) : fallbackCopy.expandHero(hero.hero);
                const collapseLabel =
                  typeof copy.collapseHero === 'function' ? copy.collapseHero(hero.hero) : fallbackCopy.collapseHero(hero.hero);

                return [
                  <tr
                    key={`hero-row-${rowId}`}
                    className={`hero-row ${isSelected ? 'is-selected' : ''}`}
                  >
                    <td>
                      <button
                        type="button"
                        className="hero-expand-btn"
                        onClick={() => onSelectHero?.(hero)}
                        aria-expanded={isSelected}
                        aria-controls={detailId}
                        aria-label={isSelected ? collapseLabel : expandLabel}
                      >
                        <span className="hero-name-cell">
                          {hero.heroAvatar ? <img src={hero.heroAvatar} alt="" className="hero-avatar" loading="lazy" /> : null}
                          <span>{hero.hero}</span>
                        </span>
                        <span className="hero-expand-indicator" aria-hidden="true">
                          {isSelected ? '−' : '+'}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`attribute-tag is-${attributeTone}`}>{attributeLabel}</span>
                    </td>
                    <td>
                      {hero.matches}
                      {unknownOutcomeMatches > 0 ? (
                        <span className="unknown-outcome-note" title={unknownOutcomeLabel} aria-label={unknownOutcomeLabel}>
                          +?
                        </span>
                      ) : null}
                    </td>
                    <td>{winRate}</td>
                    <td>{avgKda}</td>
                    <td>{avgGpm}</td>
                    <td>{avgXpm}</td>
                    <td>
                      <div className="impact-cell">
                        <span>{impact}</span>
                        {Number.isFinite(hero.impact) ? (
                          <div className="impact-bar">
                            <i style={{ width: `${hero.impact}%` }} />
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>,
                  isSelected ? (
                    <tr key={`hero-row-detail-${rowId}`} id={detailId} className="hero-row-detail">
                      <td colSpan={8}>
                        {heroMatches.length > 0 ? (
                          <div
                            className="hero-match-table-wrap"
                            role="region"
                            aria-label={
                              typeof copy.heroMatchesTableAriaLabel === 'function'
                                ? copy.heroMatchesTableAriaLabel(hero.hero)
                                : fallbackCopy.heroMatchesTableAriaLabel(hero.hero)
                            }
                            tabIndex={0}
                          >
                            <table className="hero-match-table">
                              <caption className="sr-only">
                                {typeof copy.heroMatchesTableAriaLabel === 'function'
                                  ? copy.heroMatchesTableAriaLabel(hero.hero)
                                  : fallbackCopy.heroMatchesTableAriaLabel(hero.hero)}
                              </caption>
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
                                  <th>
                                    <span className="sr-only">{effectiveRecentCopy.openMatch}</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {heroMatches.map((match) => {
                                  const kdaLine = formatKdaLine(match, effectiveRecentCopy.emptyValue);
                                  const gpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : effectiveRecentCopy.emptyValue;
                                  const xpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : effectiveRecentCopy.emptyValue;
                                  const heroDamage = formatNumber(match.heroDamage, locale, effectiveRecentCopy.emptyValue);
                                  const timeTag = resolveMatchTimeTag(match.startTime, timeBoundaries, effectiveRecentCopy.timeTags);
                                  const dateText = formatDateTime(match.startTime, locale, effectiveRecentCopy.emptyValue);
                                  const resultText = effectiveRecentCopy.result[match.result] ?? effectiveRecentCopy.emptyValue;
                                  const rankPresentation = getRankPresentation(match, effectiveRecentCopy);
                                  const openAriaLabel =
                                    typeof effectiveRecentCopy.openMatchAriaLabel === 'function'
                                      ? effectiveRecentCopy.openMatchAriaLabel({
                                          hero: hero.hero,
                                          result: resultText,
                                          date: dateText,
                                        })
                                      : fallbackRecentCopy.openMatchAriaLabel({
                                          hero: hero.hero,
                                          result: resultText,
                                          date: dateText,
                                        });

                                  return (
                                    <tr key={match.matchId} className={selectedMatchId === match.matchId ? 'is-selected' : ''}>
                                      <td>
                                        <div className="recent-date-cell">
                                          <span>{dateText}</span>
                                          {timeTag ? <span className={`recent-time-tag is-${timeTag.key}`}>{timeTag.label}</span> : null}
                                        </div>
                                      </td>
                                      <td>
                                        <span className={`result-pill ${getResultTone(match.result)}`}>
                                          {resultText}
                                        </span>
                                      </td>
                                      <td>
                                        {kdaLine}
                                      </td>
                                      <td>
                                        {gpm} / {xpm}
                                      </td>
                                      <td>{heroDamage}</td>
                                      <td>{formatDuration(match.durationSec, effectiveRecentCopy.emptyValue)}</td>
                                      <td>
                                        <span title={rankPresentation.kind} aria-label={rankPresentation.ariaLabel}>
                                          {rankPresentation.value}
                                        </span>
                                      </td>
                                      <td>{match.matchId}</td>
                                      <td className="table-action-cell">
                                        <button
                                          type="button"
                                          className="table-row-action"
                                          onClick={() => onSelectMatch?.(match)}
                                          aria-label={openAriaLabel}
                                          aria-pressed={selectedMatchId === match.matchId}
                                        >
                                          {effectiveRecentCopy.openMatch}
                                        </button>
                                      </td>
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

      <div className="hero-mobile-list" aria-label={copy.tableAriaLabel || fallbackCopy.tableAriaLabel}>
        {heroes.length > 0 ? (
          heroes.map((hero) => {
            const rowId = hero.heroId ?? hero.hero;
            const isSelected = selectedHeroId === rowId;
            const detailId = `hero-mobile-detail-${String(rowId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const heroMatches = heroMatchesMap.get(rowId) ?? [];
            const winRate = formatHeroWinRate(hero, effectiveRecentCopy.emptyValue);
            const impact = Number.isFinite(hero.impact)
              ? hero.impact
              : effectiveRecentCopy.emptyValue;
            const avgKda = Number.isFinite(hero.avgKda)
              ? hero.avgKda
              : effectiveRecentCopy.emptyValue;
            const unknownOutcomeMatches = Number.isFinite(hero.unknownOutcomeMatches)
              ? Math.max(0, hero.unknownOutcomeMatches)
              : Number.isFinite(hero.unknownOutcomes)
                ? Math.max(0, hero.unknownOutcomes)
                : Math.max(0, (hero.matches ?? 0) - (hero.outcomeMatches ?? hero.matches ?? 0));
            const unknownOutcomeLabel =
              typeof copy.unknownOutcomeMatches === 'function'
                ? copy.unknownOutcomeMatches(unknownOutcomeMatches)
                : fallbackCopy.unknownOutcomeMatches(unknownOutcomeMatches);
            const attributeTone = resolveAttributeTone(hero.attribute);
            const expandLabel =
              typeof copy.expandHero === 'function' ? copy.expandHero(hero.hero) : fallbackCopy.expandHero(hero.hero);
            const collapseLabel =
              typeof copy.collapseHero === 'function' ? copy.collapseHero(hero.hero) : fallbackCopy.collapseHero(hero.hero);

            return (
              <article key={`hero-mobile-${rowId}`} className={`hero-mobile-item ${isSelected ? 'is-selected' : ''}`}>
                <button
                  type="button"
                  className="hero-mobile-card"
                  onClick={() => onSelectHero?.(hero)}
                  aria-expanded={isSelected}
                  aria-controls={detailId}
                  aria-label={isSelected ? collapseLabel : expandLabel}
                >
                  <span className="hero-mobile-card__head">
                    <span className="hero-name-cell">
                      {hero.heroAvatar ? <img src={hero.heroAvatar} alt="" className="hero-avatar" loading="lazy" /> : null}
                      <strong>{hero.hero}</strong>
                    </span>
                    <span className={`attribute-tag is-${attributeTone}`}>{hero.attribute || '-'}</span>
                  </span>
                  <span className="hero-mobile-card__metrics">
                    <span>
                      <em>{copy.headers.matches}</em>
                      <strong>
                        {hero.matches}
                        {unknownOutcomeMatches > 0 ? (
                          <span className="unknown-outcome-note" title={unknownOutcomeLabel} aria-label={unknownOutcomeLabel}>
                            +?
                          </span>
                        ) : null}
                      </strong>
                    </span>
                    <span>
                      <em>{copy.headers.winRate}</em>
                      <strong>{winRate}</strong>
                    </span>
                    <span>
                      <em>{copy.headers.avgKda}</em>
                      <strong>{avgKda}</strong>
                    </span>
                    <span>
                      <em>{copy.headers.impact}</em>
                      <strong>{impact}</strong>
                    </span>
                  </span>
                </button>

                {isSelected ? (
                  <div id={detailId} className="hero-mobile-detail">
                    {heroMatches.length > 0 ? (
                      <div className="hero-mobile-match-list">
                        {heroMatches.map((match) => {
                          const dateText = formatDateTime(match.startTime, locale, effectiveRecentCopy.emptyValue);
                          const resultText = effectiveRecentCopy.result[match.result] ?? effectiveRecentCopy.emptyValue;
                          const openAriaLabel =
                            typeof effectiveRecentCopy.openMatchAriaLabel === 'function'
                              ? effectiveRecentCopy.openMatchAriaLabel({
                                  hero: hero.hero,
                                  result: resultText,
                                  date: dateText,
                                })
                              : fallbackRecentCopy.openMatchAriaLabel({
                                  hero: hero.hero,
                                  result: resultText,
                                  date: dateText,
                                });

                          return (
                            <button
                              key={`hero-mobile-match-${match.matchId}`}
                              type="button"
                              className={`hero-mobile-match ${selectedMatchId === match.matchId ? 'is-selected' : ''}`}
                              onClick={() => onSelectMatch?.(match)}
                              aria-label={openAriaLabel}
                              aria-pressed={selectedMatchId === match.matchId}
                            >
                              <span>
                                <strong>{dateText}</strong>
                                <span className={`result-pill ${getResultTone(match.result)}`}>{resultText}</span>
                              </span>
                              <span>
                                {effectiveRecentCopy.headers.kda}: {formatKdaLine(match, effectiveRecentCopy.emptyValue)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="empty-text hero-match-empty">{copy.heroMatchesEmpty ?? fallbackCopy.heroMatchesEmpty}</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="empty-text">{copy.empty}</p>
        )}
      </div>
    </section>
  );
}

export default HeroPerformanceTable;

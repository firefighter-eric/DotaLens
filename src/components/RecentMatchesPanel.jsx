import { useId } from 'react';
import { differenceInLocalCalendarDays, toValidUnixDate } from '../utils/date.js';

const fallbackCopy = {
  title: (count) => `最近 ${count} 场详细分析`,
  tag: (count) => `最近 ${count} 场`,
  paginationAriaLabel: '最近比赛分页',
  pageIndicator: (page, totalPages, start, end, totalCount) => `第 ${page}/${totalPages} 页 · ${start}-${end} / ${totalCount}`,
  prevPage: '上一页',
  nextPage: '下一页',
  noDataText: '暂无最近比赛数据。',
  loadingText: '正在更新比赛数据…',
  retry: '重试',
  openHint: '点击任意一行查看详情',
  openMatch: '查看',
  openMatchAriaLabel: ({ hero, result, date }) => `查看 ${date} ${hero} ${result}的比赛详情`,
  tableAriaLabel: '最近比赛数据表',
  summary: {
    winRate: '胜率',
    outcomeCoverage: ({ known, total }) => `赛果可判定 ${known}/${total}`,
    avgKda: '平均 KDA',
    avgGpm: '平均 GPM',
    avgDuration: '平均时长',
  },
  durationUnit: 'm',
  headers: {
    date: '时间',
    hero: '英雄',
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
  timeTags: {
    today: '今天',
    yesterday: '昨天',
    within3Days: '3天内',
    within7Days: '7天内',
    within30Days: '30天内',
  },
  emptyValue: '-',
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
  const rankKinds = copy.rankKinds || fallbackCopy.rankKinds;
  const kind = rankKinds[match.rankKind] || rankKinds.unknown;
  const ariaLabel =
    typeof copy.rankAriaLabel === 'function'
      ? copy.rankAriaLabel({ value, kind })
      : fallbackCopy.rankAriaLabel({ value, kind });
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

function RecentMatchesPanel({
  matches = [],
  summary,
  copy = fallbackCopy,
  lang = 'zh',
  page = 1,
  pageSize = 30,
  totalCount = 0,
  totalPages = 1,
  onPageChange,
  selectedMatchId = null,
  onSelectMatch,
  loading = false,
  error = '',
  onRetry,
}) {
  const titleId = useId();
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const safeSummary = summary ?? {
    total: 0,
    ratedTotal: 0,
    winRate: null,
    avgKda: null,
    avgGpm: null,
    avgDurationMin: null,
  };
  const winRateValue =
    safeSummary.winRate == null ? copy.emptyValue : `${safeSummary.winRate}%`;
  const avgGpmValue = Number.isFinite(safeSummary.avgGpm) ? safeSummary.avgGpm : copy.emptyValue;
  const avgKdaValue = safeSummary.avgKda ?? copy.emptyValue;
  const avgDurationValue = Number.isFinite(safeSummary.avgDurationMin)
    ? `${safeSummary.avgDurationMin}${copy.durationUnit}`
    : copy.emptyValue;
  const title = typeof copy.title === 'function' ? copy.title(totalCount) : copy.title;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const hasMatches = matches.length > 0;
  const pageStart = hasMatches ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = hasMatches ? pageStart + matches.length - 1 : 0;
  const pageIndicator =
    typeof copy.pageIndicator === 'function'
      ? copy.pageIndicator(safePage, totalPages, pageStart, pageEnd, totalCount)
      : `${safePage}/${totalPages}`;
  const localizedFallbackTimeTags =
    lang === 'en'
      ? {
          today: 'Today',
          yesterday: 'Yesterday',
          within3Days: 'Within 3 Days',
          within7Days: 'Within 7 Days',
          within30Days: 'Within 30 Days',
        }
      : fallbackCopy.timeTags;
  const timeTags = {
    ...localizedFallbackTimeTags,
    ...(copy.timeTags ?? {}),
  };
  const timeBoundaries = { today: new Date() };

  return (
    <section className="panel recent-panel" aria-labelledby={titleId} aria-busy={loading}>
      <div className="panel-header recent-panel-header">
        <h2 id={titleId}>{title}</h2>
        <div className="recent-panel-actions">
          <span className="panel-tag">{copy.tag(totalCount)}</span>
          <span className="panel-tag panel-tag--subtle">{copy.openHint || fallbackCopy.openHint}</span>
          <div className="range-switch recent-limit-switch" role="group" aria-label={copy.paginationAriaLabel}>
            <button type="button" onClick={() => onPageChange?.(safePage - 1)} disabled={!onPageChange || safePage <= 1}>
              {copy.prevPage}
            </button>
            <span className="recent-page-indicator">{pageIndicator}</span>
            <button
              type="button"
              onClick={() => onPageChange?.(safePage + 1)}
              disabled={!onPageChange || safePage >= totalPages}
            >
              {copy.nextPage}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="panel-state" role="status" aria-live="polite">
          {copy.loadingText || fallbackCopy.loadingText}
        </p>
      ) : null}
      {error ? (
        <div className="panel-state-row" role="alert">
          <p className="panel-state is-error">{error}</p>
          {onRetry ? (
            <button type="button" className="panel-retry-btn" onClick={onRetry}>
              {copy.retry || fallbackCopy.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {hasMatches ? (
        <>
          <div className="recent-summary-grid">
            <div className="recent-summary-item">
              <span>{copy.summary.winRate}</span>
              <strong>{winRateValue}</strong>
              <small>
                {typeof copy.summary.outcomeCoverage === 'function'
                  ? copy.summary.outcomeCoverage({
                      known: safeSummary.ratedTotal ?? 0,
                      total: safeSummary.total ?? totalCount,
                    })
                  : fallbackCopy.summary.outcomeCoverage({
                      known: safeSummary.ratedTotal ?? 0,
                      total: safeSummary.total ?? totalCount,
                    })}
              </small>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.avgKda}</span>
              <strong>{avgKdaValue}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.avgGpm}</span>
              <strong>{avgGpmValue}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.avgDuration}</span>
              <strong>{avgDurationValue}</strong>
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
                  <th>{copy.headers.date}</th>
                  <th>{copy.headers.hero}</th>
                  <th>{copy.headers.result}</th>
                  <th>{copy.headers.kda}</th>
                  <th>{copy.headers.gpmXpm}</th>
                  <th>{copy.headers.heroDamage}</th>
                  <th>{copy.headers.duration}</th>
                  <th>{copy.headers.rank}</th>
                  <th>{copy.headers.matchId}</th>
                  <th>
                    <span className="sr-only">{copy.openMatch || fallbackCopy.openMatch}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const kdaLine = formatKdaLine(match, copy.emptyValue);
                  const gpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : copy.emptyValue;
                  const xpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : copy.emptyValue;
                  const heroDamage = formatNumber(match.heroDamage, locale, copy.emptyValue);
                  const timeTag = resolveMatchTimeTag(match.startTime, timeBoundaries, timeTags);
                  const dateText = formatDateTime(match.startTime, locale, copy.emptyValue);
                  const resultText = copy.result[match.result] ?? copy.emptyValue;
                  const rankPresentation = getRankPresentation(match, copy);
                  const openAriaLabel =
                    typeof copy.openMatchAriaLabel === 'function'
                      ? copy.openMatchAriaLabel({ hero: match.hero, result: resultText, date: dateText })
                      : fallbackCopy.openMatchAriaLabel({ hero: match.hero, result: resultText, date: dateText });

                  return (
                    <tr key={match.matchId} className={selectedMatchId === match.matchId ? 'is-selected' : ''}>
                      <td>
                        <div className="recent-date-cell">
                          <span>{dateText}</span>
                          {timeTag ? <span className={`recent-time-tag is-${timeTag.key}`}>{timeTag.label}</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="hero-name-cell">
                          {match.heroAvatar ? (
                            <img src={match.heroAvatar} alt="" className="hero-avatar" loading="lazy" />
                          ) : null}
                          <span>{match.hero || copy.emptyValue}</span>
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
                      <td>{formatDuration(match.durationSec, copy.emptyValue)}</td>
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
                          {copy.openMatch || fallbackCopy.openMatch}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="recent-mobile-list" aria-label={copy.tableAriaLabel || fallbackCopy.tableAriaLabel}>
            {matches.map((match) => {
              const dateText = formatDateTime(match.startTime, locale, copy.emptyValue);
              const resultText = copy.result[match.result] ?? copy.emptyValue;
              const kdaLine = formatKdaLine(match, copy.emptyValue);
              const gpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : copy.emptyValue;
              const xpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : copy.emptyValue;
              const rankPresentation = getRankPresentation(match, copy);
              const openAriaLabel =
                typeof copy.openMatchAriaLabel === 'function'
                  ? copy.openMatchAriaLabel({ hero: match.hero, result: resultText, date: dateText })
                  : fallbackCopy.openMatchAriaLabel({ hero: match.hero, result: resultText, date: dateText });

              return (
                <button
                  key={`mobile-${match.matchId}`}
                  type="button"
                  className={`recent-mobile-card ${selectedMatchId === match.matchId ? 'is-selected' : ''}`}
                  onClick={() => onSelectMatch?.(match)}
                  aria-label={openAriaLabel}
                  aria-pressed={selectedMatchId === match.matchId}
                >
                  <span className="recent-mobile-card__head">
                    <span className="hero-name-cell">
                      {match.heroAvatar ? <img src={match.heroAvatar} alt="" className="hero-avatar" loading="lazy" /> : null}
                      <strong>{match.hero || copy.emptyValue}</strong>
                    </span>
                    <span className={`result-pill ${getResultTone(match.result)}`}>{resultText}</span>
                  </span>
                  <span className="recent-mobile-card__date">{dateText}</span>
                  <span className="recent-mobile-card__metrics">
                    <span>
                      <em>{copy.headers.kda}</em>
                      <strong>
                        {kdaLine}
                      </strong>
                    </span>
                    <span>
                      <em>{copy.headers.gpmXpm}</em>
                      <strong>
                        {gpm} / {xpm}
                      </strong>
                    </span>
                    <span>
                      <em>{copy.headers.duration}</em>
                      <strong>{formatDuration(match.durationSec, copy.emptyValue)}</strong>
                    </span>
                    <span>
                      <em>{copy.headers.rank}</em>
                      <strong title={rankPresentation.kind} aria-label={rankPresentation.ariaLabel}>
                        {rankPresentation.value}
                      </strong>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="empty-text">{copy.noDataText}</p>
      )}
    </section>
  );
}

export default RecentMatchesPanel;

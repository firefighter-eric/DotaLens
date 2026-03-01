const fallbackCopy = {
  title: (count) => `最近 ${count} 场详细分析`,
  tag: (count) => `最近 ${count} 场`,
  limitAriaLabel: '最近比赛场次',
  noDataText: '暂无最近比赛数据。',
  openHint: '点击任意一行查看详情',
  summary: {
    winRate: '胜率',
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
    thisWeek: '本周',
  },
  emptyValue: '-',
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

const getWeekStartMs = (date) => {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dayOffset);
  return weekStart.getTime();
};

const resolveMatchTimeTag = (startTime, boundaries, labels) => {
  if (!startTime || !labels) {
    return null;
  }

  const startMs = startTime * 1000;
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const matchDayStartMs = getDayStartMs(new Date(startMs));
  if (matchDayStartMs === boundaries.todayStartMs) {
    return { key: 'today', label: labels.today };
  }
  if (matchDayStartMs === boundaries.yesterdayStartMs) {
    return { key: 'yesterday', label: labels.yesterday };
  }
  if (matchDayStartMs >= boundaries.weekStartMs && matchDayStartMs < boundaries.yesterdayStartMs) {
    return { key: 'thisWeek', label: labels.thisWeek };
  }

  return null;
};

function RecentMatchesPanel({
  matches = [],
  summary,
  copy = fallbackCopy,
  lang = 'zh',
  limit = 10,
  options = [10, 20, 30],
  onLimitChange,
  selectedMatchId = null,
  onSelectMatch,
}) {
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const safeSummary = summary ?? {
    winRate: '0.0',
    avgKda: '0.00',
    avgGpm: null,
    avgDurationMin: 0,
  };
  const avgGpmValue = Number.isFinite(safeSummary.avgGpm) ? safeSummary.avgGpm : copy.emptyValue;
  const title = typeof copy.title === 'function' ? copy.title(limit) : copy.title;
  const timeTags = copy.timeTags ?? fallbackCopy.timeTags;
  const now = new Date();
  const timeBoundaries = {
    todayStartMs: getDayStartMs(now),
    yesterdayStartMs: getDayStartMs(now) - DAY_MS,
    weekStartMs: getWeekStartMs(now),
  };

  return (
    <section className="panel recent-panel">
      <div className="panel-header recent-panel-header">
        <h2>{title}</h2>
        <div className="recent-panel-actions">
          <span className="panel-tag">{copy.tag(matches.length)}</span>
          <span className="panel-tag panel-tag--subtle">{copy.openHint || fallbackCopy.openHint}</span>
          <div className="range-switch recent-limit-switch" role="group" aria-label={copy.limitAriaLabel}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={limit === option ? 'is-active' : ''}
                onClick={() => onLimitChange?.(option)}
                disabled={!onLimitChange}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {matches.length > 0 ? (
        <>
          <div className="recent-summary-grid">
            <div className="recent-summary-item">
              <span>{copy.summary.winRate}</span>
              <strong>{safeSummary.winRate}%</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.avgKda}</span>
              <strong>{safeSummary.avgKda}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.avgGpm}</span>
              <strong>{avgGpmValue}</strong>
            </div>
            <div className="recent-summary-item">
              <span>{copy.summary.avgDuration}</span>
              <strong>
                {safeSummary.avgDurationMin}
                {copy.durationUnit}
              </strong>
            </div>
          </div>

          <div className="table-wrap recent-table-wrap">
            <table className="recent-table">
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
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const kdaValue = Number.isFinite(match.kda) ? match.kda.toFixed(2) : copy.emptyValue;
                  const gpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : copy.emptyValue;
                  const xpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : copy.emptyValue;
                  const heroDamage = formatNumber(match.heroDamage, locale, copy.emptyValue);
                  const rowClassName = `recent-row ${selectedMatchId === match.matchId ? 'is-selected' : ''}`;
                  const timeTag = resolveMatchTimeTag(match.startTime, timeBoundaries, timeTags);

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
                          <span>{formatDateTime(match.startTime, locale, copy.emptyValue)}</span>
                          {timeTag ? <span className={`recent-time-tag is-${timeTag.key}`}>{timeTag.label}</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="hero-name-cell">
                          {match.heroAvatar ? (
                            <img src={match.heroAvatar} alt={match.hero} className="hero-avatar" loading="lazy" />
                          ) : null}
                          <span>{match.hero || copy.emptyValue}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`result-pill ${match.result === 'win' ? 'is-win' : 'is-loss'}`}>
                          {copy.result[match.result] ?? copy.emptyValue}
                        </span>
                      </td>
                      <td>
                        {match.kills}/{match.deaths}/{match.assists} ({kdaValue})
                      </td>
                      <td>
                        {gpm} / {xpm}
                      </td>
                      <td>{heroDamage}</td>
                      <td>{formatDuration(match.durationSec, copy.emptyValue)}</td>
                      <td>{match.rank || copy.emptyValue}</td>
                      <td>{match.matchId}</td>
                    </tr>
                  );
                })}
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

export default RecentMatchesPanel;

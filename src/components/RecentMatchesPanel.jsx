const fallbackCopy = {
  title: (count) => `最近 ${count} 场详细分析`,
  tag: (count) => `最近 ${count} 场`,
  limitAriaLabel: '最近对局场次',
  noDataText: '暂无最近对局数据。',
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
    duration: '时长',
    laneRole: '分路',
    rank: '段位',
    matchId: '对局 ID',
  },
  result: {
    win: '胜利',
    loss: '失败',
  },
  emptyValue: '-',
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
                  <th>{copy.headers.duration}</th>
                  <th>{copy.headers.laneRole}</th>
                  <th>{copy.headers.rank}</th>
                  <th>{copy.headers.matchId}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const kdaValue = Number.isFinite(match.kda) ? match.kda.toFixed(2) : copy.emptyValue;
                  const gpm = Number.isFinite(match.goldPerMin) ? match.goldPerMin : copy.emptyValue;
                  const xpm = Number.isFinite(match.xpPerMin) ? match.xpPerMin : copy.emptyValue;
                  const rowClassName = `recent-row ${selectedMatchId === match.matchId ? 'is-selected' : ''}`;

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
                      <td>{formatDateTime(match.startTime, locale, copy.emptyValue)}</td>
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
                      <td>{formatDuration(match.durationSec, copy.emptyValue)}</td>
                      <td>{match.laneRole || copy.emptyValue}</td>
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

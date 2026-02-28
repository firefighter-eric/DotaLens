const fallbackCopy = {
  title: (days) => `${days} 天胜率走势`,
  latestWinRate: (value) => `最新胜率 ${value}%`,
  noDataTag: '暂无可用数据',
  noDataText: '当前时间窗口没有对局数据。',
  ariaLabel: (days) => `${days}天胜率走势`,
};

function WinRateTrend({ data, days = 14, copy = fallbackCopy }) {
  if (!data.length) {
    return (
      <section className="panel trend-panel">
        <div className="panel-header">
          <h2>{copy.title(days)}</h2>
          <span className="panel-tag">{copy.noDataTag}</span>
        </div>
        <p className="empty-text">{copy.noDataText}</p>
      </section>
    );
  }

  const width = 720;
  const height = 220;
  const min = Math.min(...data.map((point) => point.value)) - 3;
  const max = Math.max(...data.map((point) => point.value)) + 3;
  const scale = Math.max(1, max - min);

  const points = data
    .map((point, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const y = height - ((point.value - min) / scale) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const last = data[data.length - 1];

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <h2>{copy.title(days)}</h2>
        <span className="panel-tag">{copy.latestWinRate(last.value)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label={copy.ariaLabel(days)}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16, 163, 127, 0.24)" />
            <stop offset="100%" stopColor="rgba(16, 163, 127, 0)" />
          </linearGradient>
        </defs>
        <polyline points={points} className="trend-line" />
        <polygon points={`0,${height} ${points} ${width},${height}`} className="trend-area" />
      </svg>
      <div className="trend-labels">
        {data.map((point) => (
          <span key={point.day}>{point.day}</span>
        ))}
      </div>
    </section>
  );
}

export default WinRateTrend;

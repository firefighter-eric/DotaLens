const fallbackCopy = {
  title: (days) => `${days} 天胜率走势`,
  latestWinRate: (value) => `最新胜率 ${value}%`,
  noDataTag: '暂无可用数据',
  noDataText: '当前时间窗口没有比赛数据。',
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
  const paddingTop = 10;
  const paddingRight = 12;
  const paddingBottom = 10;
  const paddingLeft = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const rawMin = Math.min(...data.map((point) => point.value));
  const rawMax = Math.max(...data.map((point) => point.value));
  let min = Math.max(0, Math.floor((rawMin - 4) / 5) * 5);
  let max = Math.min(100, Math.ceil((rawMax + 4) / 5) * 5);

  if (min === max) {
    min = Math.max(0, min - 5);
    max = Math.min(100, max + 5);
  }

  const scale = Math.max(1, max - min);
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = Math.round(max - ratio * (max - min));
    const y = paddingTop + ratio * plotHeight;
    return { value, y };
  });

  const points = data
    .map((point, index) => {
      const x = paddingLeft + (index / Math.max(1, data.length - 1)) * plotWidth;
      const y = paddingTop + (1 - (point.value - min) / scale) * plotHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const last = data[data.length - 1];
  const xLabelPaddingLeft = `${(paddingLeft / width) * 100}%`;
  const xLabelPaddingRight = `${(paddingRight / width) * 100}%`;

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
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} className="trend-grid-line" />
            <text x={paddingLeft - 8} y={tick.y} className="trend-axis-text">
              {tick.value}%
            </text>
          </g>
        ))}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          className="trend-axis-line"
        />
        <polyline points={points} className="trend-line" />
        <polygon
          points={`${paddingLeft},${height - paddingBottom} ${points} ${width - paddingRight},${height - paddingBottom}`}
          className="trend-area"
        />
      </svg>
      <div className="trend-labels" style={{ paddingInline: `${xLabelPaddingLeft} ${xLabelPaddingRight}` }}>
        {data.map((point) => (
          <span key={point.day}>{point.day}</span>
        ))}
      </div>
    </section>
  );
}

export default WinRateTrend;

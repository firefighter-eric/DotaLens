function WinRateTrend({ data }) {
  const width = 720;
  const height = 220;
  const min = Math.min(...data.map((point) => point.value)) - 3;
  const max = Math.max(...data.map((point) => point.value)) + 3;

  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((point.value - min) / (max - min)) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const last = data[data.length - 1];

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <h2>14 天胜率走势</h2>
        <span className="panel-tag">最新胜率 {last.value}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="14天胜率走势">
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(53, 195, 164, 0.55)" />
            <stop offset="100%" stopColor="rgba(53, 195, 164, 0)" />
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

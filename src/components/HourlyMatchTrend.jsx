import { useId } from 'react';

const fallbackCopy = {
  hourlyTitle: (days) => `${days} 天活跃时段`,
  hourlyTag: ({ totalMatches, peakHour, peakCount }) => `共 ${totalMatches} 场 · ${peakHour} 点最高 ${peakCount} 场`,
  hourlyAriaLabel: (days) => `${days}天按小时场次与占比分布`,
  hourlyLegendCount: '游戏次数',
  hourlyLegendRatio: '占比',
  hourlyLeftAxis: (value) => String(value),
  hourlyRightAxis: (value) => `${value}%`,
  noDataTag: '暂无可用数据',
  noDataText: '当前时间窗口没有比赛数据。',
  hourlySummary: ({ totalMatches, peakHour, peakCount, peakRatio }) =>
    `共 ${totalMatches} 场；${peakHour}:00 最活跃，共 ${peakCount} 场，占 ${peakRatio}%。`,
  dataTableLabel: '查看精确数据',
  dataTableHour: '小时',
  dataTableMatches: '场次',
  dataTableRatio: '占比',
};

const resolveCountStep = (maxCount) => {
  if (maxCount <= 4) {
    return 1;
  }
  if (maxCount <= 8) {
    return 2;
  }
  if (maxCount <= 20) {
    return 5;
  }
  if (maxCount <= 40) {
    return 10;
  }
  if (maxCount <= 80) {
    return 20;
  }
  return 50;
};

function HourlyMatchTrend({ data = [], days = 14, copy = fallbackCopy }) {
  const gradientId = useId().replace(/:/g, '');
  const summaryId = `${gradientId}-summary`;
  const safeData = Array.isArray(data) ? data.slice(0, 24) : [];
  const totalMatches = safeData.reduce((sum, point) => sum + (Number(point?.matches) || 0), 0);

  if (safeData.length === 0 || totalMatches === 0) {
    return (
      <section className="panel trend-panel">
        <div className="panel-header">
          <h2>{copy.hourlyTitle?.(days) ?? fallbackCopy.hourlyTitle(days)}</h2>
          <span className="panel-tag">{copy.noDataTag ?? fallbackCopy.noDataTag}</span>
        </div>
        <p className="empty-text">{copy.noDataText ?? fallbackCopy.noDataText}</p>
      </section>
    );
  }

  const peak = safeData.reduce((best, point) => (point.matches > best.matches ? point : best), safeData[0]);
  const tag = copy.hourlyTag?.({
    totalMatches,
    peakHour: peak.hour,
    peakCount: peak.matches,
  }) ?? fallbackCopy.hourlyTag({ totalMatches, peakHour: peak.hour, peakCount: peak.matches });
  const summaryText =
    copy.hourlySummary?.({
      totalMatches,
      peakHour: peak.hour,
      peakCount: peak.matches,
      peakRatio: peak.ratio,
    }) ??
    fallbackCopy.hourlySummary({
      totalMatches,
      peakHour: peak.hour,
      peakCount: peak.matches,
      peakRatio: peak.ratio,
    });

  const width = 720;
  const height = 260;
  const paddingTop = 12;
  const paddingRight = 46;
  const paddingBottom = 26;
  const paddingLeft = 44;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxCount = Math.max(...safeData.map((point) => point.matches), 1);
  const countStep = resolveCountStep(maxCount);
  const countCeil = Math.max(countStep * 4, Math.ceil(maxCount / countStep) * countStep);
  const maxRatio = Math.max(...safeData.map((point) => point.ratio), 1);
  const ratioCeil = Math.max(5, Math.ceil(maxRatio / 5) * 5);

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = paddingTop + ratio * plotHeight;
    const countValue = Math.round((1 - ratio) * countCeil);
    const ratioValue = Number(((1 - ratio) * ratioCeil).toFixed(1));
    return { y, countValue, ratioValue };
  });

  const unitWidth = plotWidth / safeData.length;
  const barWidth = unitWidth * 0.72;
  const linePoints = safeData
    .map((point, index) => {
      const x = paddingLeft + index * unitWidth + unitWidth / 2;
      const y = paddingTop + (1 - point.ratio / ratioCeil) * plotHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <h2>{copy.hourlyTitle?.(days) ?? fallbackCopy.hourlyTitle(days)}</h2>
        <span className="panel-tag">{tag}</span>
      </div>
      <div className="hourly-legend">
        <span className="hourly-legend__item">
          <i className="hourly-legend__dot is-count" />
          {copy.hourlyLegendCount ?? fallbackCopy.hourlyLegendCount}
        </span>
        <span className="hourly-legend__item">
          <i className="hourly-legend__dot is-ratio" />
          {copy.hourlyLegendRatio ?? fallbackCopy.hourlyLegendRatio}
        </span>
      </div>
      <p id={summaryId} className="trend-text-summary">
        {summaryText}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="hourly-chart"
        role="img"
        aria-label={copy.hourlyAriaLabel?.(days) ?? fallbackCopy.hourlyAriaLabel(days)}
        aria-describedby={summaryId}
      >
        <title>{copy.hourlyAriaLabel?.(days) ?? fallbackCopy.hourlyAriaLabel(days)}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(14, 116, 144, 0.2)" />
            <stop offset="100%" stopColor="rgba(14, 116, 144, 0.05)" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => (
          <g key={`tick-${tick.y}`}>
            <line x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} className="trend-grid-line" />
            <text x={paddingLeft - 8} y={tick.y} className="trend-axis-text">
              {(copy.hourlyLeftAxis ?? fallbackCopy.hourlyLeftAxis)(tick.countValue)}
            </text>
            <text x={width - paddingRight + 8} y={tick.y} className="hourly-axis-text-right">
              {(copy.hourlyRightAxis ?? fallbackCopy.hourlyRightAxis)(tick.ratioValue)}
            </text>
          </g>
        ))}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} className="trend-axis-line" />
        <line
          x1={width - paddingRight}
          y1={paddingTop}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          className="trend-axis-line"
        />
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          className="trend-axis-line"
        />

        {safeData.map((point, index) => {
          const x = paddingLeft + index * unitWidth + (unitWidth - barWidth) / 2;
          const barHeight = (point.matches / countCeil) * plotHeight;
          const y = height - paddingBottom - barHeight;
          return (
            <rect key={`bar-${point.hour}`} x={x} y={y} width={barWidth} height={barHeight} className="hourly-bar">
              <title>
                {point.hour}:00 · {point.matches} · {point.ratio}%
              </title>
            </rect>
          );
        })}

        <polyline points={linePoints} className="hourly-line" />

        {safeData.map((point, index) => {
          const x = paddingLeft + index * unitWidth + unitWidth / 2;
          const y = paddingTop + (1 - point.ratio / ratioCeil) * plotHeight;
          return (
            <circle key={`point-${point.hour}`} cx={x} cy={y} r="2.8" className="hourly-point">
              <title>
                {point.hour}:00 · {point.matches} · {point.ratio}%
              </title>
            </circle>
          );
        })}

        {safeData.map((point, index) => {
          const x = paddingLeft + index * unitWidth + unitWidth / 2;
          return (
            <text key={`hour-${point.hour}`} x={x} y={height - 8} className="hourly-axis-text-bottom">
              {point.hour}
            </text>
          );
        })}
      </svg>
      <details className="chart-data-details">
        <summary>{copy.dataTableLabel ?? fallbackCopy.dataTableLabel}</summary>
        <div className="chart-data-table-wrap" tabIndex={0} role="region" aria-label={copy.dataTableLabel ?? fallbackCopy.dataTableLabel}>
          <table className="chart-data-table">
            <thead>
              <tr>
                <th scope="col">{copy.dataTableHour ?? fallbackCopy.dataTableHour}</th>
                <th scope="col">{copy.dataTableMatches ?? fallbackCopy.dataTableMatches}</th>
                <th scope="col">{copy.dataTableRatio ?? fallbackCopy.dataTableRatio}</th>
              </tr>
            </thead>
            <tbody>
              {safeData.map((point) => (
                <tr key={`hour-data-${point.hour}`}>
                  <th scope="row">{point.hour}:00</th>
                  <td>{point.matches}</td>
                  <td>{point.ratio}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default HourlyMatchTrend;

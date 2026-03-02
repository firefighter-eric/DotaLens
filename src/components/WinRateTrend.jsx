import { useId } from 'react';

const fallbackCopy = {
  title: (days) => `${days} 天趋势`,
  latestValue: (value) => `最新值 ${value}`,
  axisValue: (value) => String(value),
  noDataTag: '暂无可用数据',
  noDataText: '当前时间窗口没有比赛数据。',
  ariaLabel: (days) => `${days}天趋势`,
};

const resolveLabelCount = (pointCount) => {
  if (pointCount <= 14) {
    return pointCount;
  }
  if (pointCount <= 45) {
    return 10;
  }
  if (pointCount <= 120) {
    return 9;
  }
  return 12;
};

const pickXAxisLabels = (data) => {
  const pointCount = data.length;
  const labelCount = resolveLabelCount(pointCount);
  if (labelCount >= pointCount) {
    return data.map((point, index) => ({ ...point, index }));
  }

  const step = (pointCount - 1) / (labelCount - 1);
  const indexes = new Set([0, pointCount - 1]);
  for (let i = 1; i < labelCount - 1; i += 1) {
    indexes.add(Math.round(i * step));
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => ({
      day: data[index].day,
      index,
    }));
};

const resolveTrendRange = (data, percentage) => {
  const rawMin = Math.min(...data.map((point) => point.value));
  const rawMax = Math.max(...data.map((point) => point.value));

  if (percentage) {
    let min = Math.max(0, Math.floor((rawMin - 4) / 5) * 5);
    let max = Math.min(100, Math.ceil((rawMax + 4) / 5) * 5);

    if (min === max) {
      min = Math.max(0, min - 5);
      max = Math.min(100, max + 5);
    }
    return { min, max };
  }

  const resolveNiceStep = (range) => {
    if (range <= 3) {
      return 0.25;
    }
    if (range <= 8) {
      return 0.5;
    }
    if (range <= 20) {
      return 1;
    }
    if (range <= 60) {
      return 2;
    }
    if (range <= 150) {
      return 5;
    }
    if (range <= 300) {
      return 10;
    }
    return 20;
  };

  let min = rawMin;
  let max = rawMax;
  if (min === max) {
    const delta = Math.max(1, Math.abs(max) * 0.1);
    min -= delta;
    max += delta;
  }

  const span = max - min;
  const padding = Math.max(span * 0.12, span < 10 ? 0.5 : 1);
  min = Math.max(0, min - padding);
  max += padding;

  const step = resolveNiceStep(max - min);
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (min === max) {
    max = min + step;
  }

  return {
    min: Number(min.toFixed(step < 1 ? 2 : 0)),
    max: Number(max.toFixed(step < 1 ? 2 : 0)),
  };
};

function WinRateTrend({ data, days = 14, copy = fallbackCopy, percentage = false }) {
  const gradientId = useId().replace(/:/g, '');
  const latestValueFormatter = copy.latestValue ?? copy.latestWinRate ?? fallbackCopy.latestValue;
  const axisValueFormatter = copy.axisValue ?? ((value) => (percentage ? `${value}%` : String(value)));

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
  const { min, max } = resolveTrendRange(data, percentage);

  const scale = Math.max(1, max - min);
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const rawValue = max - ratio * (max - min);
    const value = Number(rawValue.toFixed(2));
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
  const xAxisLabels = pickXAxisLabels(data);
  const xLabelPaddingLeft = `${(paddingLeft / width) * 100}%`;
  const xLabelPaddingRight = `${(paddingRight / width) * 100}%`;

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <h2>{copy.title(days)}</h2>
        <span className="panel-tag">{latestValueFormatter(last.value)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label={copy.ariaLabel(days)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16, 163, 127, 0.24)" />
            <stop offset="100%" stopColor="rgba(16, 163, 127, 0)" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} className="trend-grid-line" />
            <text x={paddingLeft - 8} y={tick.y} className="trend-axis-text">
              {axisValueFormatter(tick.value)}
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
          style={{ fill: `url(#${gradientId})` }}
        />
      </svg>
      <div className="trend-labels" style={{ paddingInline: `${xLabelPaddingLeft} ${xLabelPaddingRight}` }}>
        {xAxisLabels.map((point) => (
          <span key={`${point.day}-${point.index}`}>{point.day}</span>
        ))}
      </div>
    </section>
  );
}

export default WinRateTrend;

import { useId } from 'react';

const fallbackCopy = {
  title: (days) => `${days} 天趋势`,
  latestValue: (value) => `最新值 ${value}`,
  axisValue: (value) => String(value),
  noDataTag: '暂无可用数据',
  noDataText: '当前时间窗口没有比赛数据。',
  ariaLabel: (days) => `${days}天趋势`,
  summary: ({ first, latest, change, min, max }) =>
    `起始值 ${first}，最新值 ${latest}，变化 ${change >= 0 ? '+' : ''}${change}，区间 ${min}–${max}。`,
  dataTableLabel: '查看精确数据',
  dataTableDate: '日期',
  dataTableValue: '数值',
  dataTableSample: '有效样本',
  dataGap: '缺口',
  gapSummary: (count) => `其中 ${count} 个时间点因样本不足留空。`,
  sampleCount: ({ sampleCount, windowSampleCount }) =>
    windowSampleCount ? `${sampleCount}/${windowSampleCount} 场` : `${sampleCount} 场`,
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

function WinRateTrend({ data = [], secondaryData = [], days = 14, copy = fallbackCopy, percentage = false }) {
  const gradientId = useId().replace(/:/g, '');
  const summaryId = `${gradientId}-summary`;
  const latestValueFormatter = copy.latestValue ?? copy.latestWinRate ?? fallbackCopy.latestValue;
  const latestDualValueFormatter = copy.latestDualValue;
  const axisValueFormatter = copy.axisValue ?? ((value) => (percentage ? `${value}%` : String(value)));
  const secondarySeriesLabel = copy.secondarySeriesLabel;
  const primarySeriesLabel = copy.primarySeriesLabel;
  const hasSecondary =
    secondaryData.length === data.length &&
    secondaryData.length > 0 &&
    secondaryData.some((point) => Number.isFinite(point?.value));
  const primaryValuePoints = data.filter((point) => Number.isFinite(point?.value));

  if (!data.length || primaryValuePoints.length === 0) {
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
  const paddingBottom = 24;
  const paddingLeft = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const valueSeries = hasSecondary
    ? [
        ...primaryValuePoints,
        ...secondaryData
          .filter((point) => Number.isFinite(point?.value))
          .map((item, index) => ({ ...item, day: data[index]?.day ?? item.day })),
      ]
    : primaryValuePoints;
  const { min, max } = resolveTrendRange(valueSeries, percentage);

  const scale = Math.max(1, max - min);
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const rawValue = max - ratio * (max - min);
    const value = Number(rawValue.toFixed(2));
    const y = paddingTop + ratio * plotHeight;
    return { value, y };
  });

  const buildSegments = (series) => {
    const segments = [];
    let activeSegment = [];

    series.forEach((point, index) => {
      if (!Number.isFinite(point?.value)) {
        if (activeSegment.length) {
          segments.push(activeSegment);
          activeSegment = [];
        }
        return;
      }

      const x = paddingLeft + (index / Math.max(1, series.length - 1)) * plotWidth;
      const y = paddingTop + (1 - (point.value - min) / scale) * plotHeight;
      activeSegment.push({ point, index, x, y });
    });

    if (activeSegment.length) {
      segments.push(activeSegment);
    }
    return segments;
  };
  const primarySegments = buildSegments(data);
  const secondarySegments = hasSecondary ? buildSegments(secondaryData) : [];

  const last = [...data].reverse().find((point) => Number.isFinite(point?.value));
  const secondaryLast = hasSecondary
    ? [...secondaryData].reverse().find((point) => Number.isFinite(point?.value))
    : null;
  const latestTag =
    hasSecondary && typeof latestDualValueFormatter === 'function' && secondaryLast
      ? latestDualValueFormatter(last.value, secondaryLast.value)
      : latestValueFormatter(last.value);
  const xAxisLabels = pickXAxisLabels(data);
  const numericValues = primaryValuePoints.map((point) => point.value);
  const firstValue = numericValues[0];
  const latestValue = numericValues[numericValues.length - 1];
  const changeValue = Number((latestValue - firstValue).toFixed(2));
  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const baseSummaryText =
    typeof copy.summary === 'function'
      ? copy.summary({ first: firstValue, latest: latestValue, change: changeValue, min: minValue, max: maxValue })
      : fallbackCopy.summary({ first: firstValue, latest: latestValue, change: changeValue, min: minValue, max: maxValue });
  const gapCount = data.length - primaryValuePoints.length;
  const gapSummary =
    gapCount > 0
      ? typeof copy.gapSummary === 'function'
        ? copy.gapSummary(gapCount)
        : fallbackCopy.gapSummary(gapCount)
      : '';
  const summaryText = gapSummary ? `${baseSummaryText} ${gapSummary}` : baseSummaryText;
  const hasSampleMetadata = data.some(
    (point) => Number.isFinite(point?.sampleCount) || Number.isFinite(point?.windowSampleCount)
  );

  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <h2>{copy.title(days)}</h2>
        <span className="panel-tag">{latestTag}</span>
      </div>
      {hasSecondary ? (
        <div className="trend-series-legend">
          <span>
            <i className="trend-series-dot" />
            {primarySeriesLabel ?? 'Series A'}
          </span>
          <span>
            <i className="trend-series-dot is-secondary" />
            {secondarySeriesLabel ?? 'Series B'}
          </span>
        </div>
      ) : null}
      <p id={summaryId} className="trend-text-summary">
        {summaryText}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart"
        role="img"
        aria-label={copy.ariaLabel(days)}
        aria-describedby={summaryId}
      >
        <title>{copy.ariaLabel(days)}</title>
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
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          className="trend-axis-line"
        />
        {primarySegments
          .filter((segment) => segment.length > 1)
          .map((segment, index) => (
            <polygon
              key={`primary-area-${index}`}
              points={`${segment[0].x},${height - paddingBottom} ${segment
                .map((point) => `${point.x},${point.y}`)
                .join(' ')} ${segment[segment.length - 1].x},${height - paddingBottom}`}
              className="trend-area"
              style={{ fill: `url(#${gradientId})` }}
            />
          ))}
        {primarySegments.map((segment, index) => (
          <polyline
            key={`primary-line-${index}`}
            points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
            className="trend-line"
          />
        ))}
        {secondarySegments.map((segment, index) => (
          <polyline
            key={`secondary-line-${index}`}
            points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
            className="trend-line trend-line--secondary"
          />
        ))}
        {data.map((point, index) => {
          if (!Number.isFinite(point?.value)) {
            return null;
          }
          const x = paddingLeft + (index / Math.max(1, data.length - 1)) * plotWidth;
          const y = paddingTop + (1 - (point.value - min) / scale) * plotHeight;
          return (
            <circle key={`primary-${point.day}-${index}`} cx={x} cy={y} r="3" className="trend-point">
              <title>
                {point.day}: {axisValueFormatter(point.value)}
              </title>
            </circle>
          );
        })}
        {hasSecondary
          ? secondaryData.map((point, index) => {
              if (!Number.isFinite(point?.value)) {
                return null;
              }
              const x = paddingLeft + (index / Math.max(1, secondaryData.length - 1)) * plotWidth;
              const y = paddingTop + (1 - (point.value - min) / scale) * plotHeight;
              return (
                <circle key={`secondary-${point.day}-${index}`} cx={x} cy={y} r="3" className="trend-point is-secondary">
                  <title>
                    {point.day}: {axisValueFormatter(point.value)}
                  </title>
                </circle>
              );
            })
          : null}
        {xAxisLabels.map((point) => {
          const x = paddingLeft + (point.index / Math.max(1, data.length - 1)) * plotWidth;
          return (
            <text key={`${point.day}-${point.index}`} x={x} y={height - 6} className="trend-axis-text-bottom">
              {point.day}
            </text>
          );
        })}
      </svg>
      <details className="chart-data-details">
        <summary>{copy.dataTableLabel || fallbackCopy.dataTableLabel}</summary>
        <div className="chart-data-table-wrap" tabIndex={0} role="region" aria-label={copy.dataTableLabel || fallbackCopy.dataTableLabel}>
          <table className="chart-data-table">
            <thead>
              <tr>
                <th scope="col">{copy.dataTableDate || fallbackCopy.dataTableDate}</th>
                <th scope="col">{primarySeriesLabel || copy.dataTableValue || fallbackCopy.dataTableValue}</th>
                {hasSecondary ? <th scope="col">{secondarySeriesLabel || fallbackCopy.dataTableValue}</th> : null}
                {hasSampleMetadata ? (
                  <th scope="col">{copy.dataTableSample || fallbackCopy.dataTableSample}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.map((point, index) => (
                <tr key={`data-${point.day}-${index}`}>
                  <th scope="row">{point.day}</th>
                  <td>
                    {Number.isFinite(point?.value)
                      ? axisValueFormatter(point.value)
                      : copy.dataGap || fallbackCopy.dataGap}
                  </td>
                  {hasSecondary ? (
                    <td>
                      {Number.isFinite(secondaryData[index]?.value)
                        ? axisValueFormatter(secondaryData[index].value)
                        : copy.dataGap || fallbackCopy.dataGap}
                    </td>
                  ) : null}
                  {hasSampleMetadata ? (
                    <td>
                      {typeof copy.sampleCount === 'function'
                        ? copy.sampleCount({
                            sampleCount: Number.isFinite(point?.sampleCount) ? point.sampleCount : 0,
                            windowSampleCount: Number.isFinite(point?.windowSampleCount)
                              ? point.windowSampleCount
                              : 0,
                          })
                        : fallbackCopy.sampleCount({
                            sampleCount: Number.isFinite(point?.sampleCount) ? point.sampleCount : 0,
                            windowSampleCount: Number.isFinite(point?.windowSampleCount)
                              ? point.windowSampleCount
                              : 0,
                          })}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default WinRateTrend;

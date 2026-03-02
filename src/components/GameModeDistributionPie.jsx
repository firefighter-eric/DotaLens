const fallbackCopy = {
  title: 'Game Mode Distribution',
  tag: (days) => `Last ${days} Days`,
  noDataText: 'No game mode data in this window.',
  totalLabel: 'Total',
  matchesLabel: (count) => `${count} matches`,
};

const PIE_COLORS = ['#0f9e7c', '#1e88e5', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const buildConicGradient = (items) => {
  let cursor = 0;
  const segments = items.map((item, index) => {
    const start = cursor;
    const end = cursor + item.ratio;
    cursor = end;
    const color = PIE_COLORS[index % PIE_COLORS.length];
    return `${color} ${start}% ${Math.min(end, 100)}%`;
  });
  return `conic-gradient(${segments.join(', ')})`;
};

function GameModeDistributionPie({ items, days = 30, copy = fallbackCopy }) {
  const totalMatches = items.reduce((sum, item) => sum + item.matches, 0);

  return (
    <section className="panel game-mode-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <span className="panel-tag">{copy.tag(days)}</span>
      </div>
      {items.length > 0 ? (
        <div className="game-mode-layout">
          <div
            className="game-mode-pie"
            style={{ background: buildConicGradient(items) }}
            role="img"
            aria-label={copy.title}
          >
            <div className="game-mode-pie-center">
              <strong>{totalMatches}</strong>
              <span>{copy.totalLabel}</span>
            </div>
          </div>
          <div className="game-mode-legend">
            {items.map((item, index) => (
              <div key={item.mode} className="game-mode-legend-item">
                <i style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                <div className="game-mode-legend-meta">
                  <span>{item.mode}</span>
                  <strong>{item.ratio}%</strong>
                </div>
                <span className="game-mode-legend-count">{copy.matchesLabel(item.matches)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-text">{copy.noDataText}</p>
      )}
    </section>
  );
}

export default GameModeDistributionPie;

const fallbackCopy = {
  title: '局内公开玩家平均段位分布',
  tag: (days) => `最近 ${days} 天`,
  noDataText: '当前公开数据没有段位信息。',
  coverage: ({ availableMatches, totalMatches }) => `覆盖 ${availableMatches}/${totalMatches} 场`,
};

function RankDistribution({ items = [], days = 30, copy = fallbackCopy, coverage }) {
  const coverageText =
    coverage && typeof copy.coverage === 'function'
      ? copy.coverage({
          availableMatches: coverage.availableMatches ?? 0,
          totalMatches: coverage.totalMatches ?? 0,
        })
      : '';

  return (
    <section className="panel rank-panel" aria-labelledby="rank-distribution-title">
      <div className="panel-header">
        <h2 id="rank-distribution-title">{copy.title}</h2>
        <span className="panel-tag">{copy.tag(days)}</span>
      </div>
      {coverageText ? <p className="data-coverage-note">{coverageText}</p> : null}
      <div className="rank-list">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.tier} className="rank-item" role="group" aria-label={`${item.tier}: ${item.ratio}%`}>
              <div className="rank-meta">
                <span>{item.tier}</span>
                <strong>{item.ratio}%</strong>
              </div>
              <div className="rank-bar" aria-hidden="true">
                <i style={{ width: `${item.ratio}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="empty-text">{copy.noDataText}</p>
        )}
      </div>
    </section>
  );
}

export default RankDistribution;

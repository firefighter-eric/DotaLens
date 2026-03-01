const fallbackCopy = {
  title: '比赛段位分布',
  tag: (days) => `最近 ${days} 天`,
  noDataText: '当前公开数据没有段位信息。',
};

function RankDistribution({ items, days = 30, copy = fallbackCopy }) {
  return (
    <section className="panel rank-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <span className="panel-tag">{copy.tag(days)}</span>
      </div>
      <div className="rank-list">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.tier} className="rank-item">
              <div className="rank-meta">
                <span>{item.tier}</span>
                <strong>{item.ratio}%</strong>
              </div>
              <div className="rank-bar">
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

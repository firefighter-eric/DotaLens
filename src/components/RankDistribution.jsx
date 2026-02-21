function RankDistribution({ items }) {
  return (
    <section className="panel rank-panel">
      <div className="panel-header">
        <h2>对局段位分布</h2>
        <span className="panel-tag">最近 30 天</span>
      </div>
      <div className="rank-list">
        {items.map((item) => (
          <div key={item.tier} className="rank-item">
            <div className="rank-meta">
              <span>{item.tier}</span>
              <strong>{item.ratio}%</strong>
            </div>
            <div className="rank-bar">
              <i style={{ width: `${item.ratio}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default RankDistribution;

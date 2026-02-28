const fallbackCopy = {
  title: '分路分布',
  tag: (days) => `最近 ${days} 天`,
  noDataText: '当前公开数据没有可识别分路信息。',
};

function RoleDistribution({ items, days = 30, copy = fallbackCopy }) {
  return (
    <section className="panel role-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <span className="panel-tag">{copy.tag(days)}</span>
      </div>
      <div className="rank-list">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.role} className="rank-item">
              <div className="rank-meta">
                <span>{item.role}</span>
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

export default RoleDistribution;

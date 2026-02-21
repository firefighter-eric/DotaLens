function StatCard({ label, value, subtext, accent = 'gold' }) {
  return (
    <article className={`stat-card stat-${accent}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-subtext">{subtext}</p>
    </article>
  );
}

export default StatCard;

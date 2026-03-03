function resolveAvatarFallback(value, overrideFallback) {
  if (typeof overrideFallback === 'string' && overrideFallback.trim()) {
    return overrideFallback.trim().slice(0, 2).toUpperCase();
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 2).toUpperCase();
  }
  return '?';
}

function StatCard({ label, value, subtext, accent = 'gold', showAvatar = false, avatar = '', avatarAlt = '', avatarFallback = '' }) {
  const fallback = resolveAvatarFallback(value, avatarFallback);
  const hasAvatar = typeof avatar === 'string' && avatar.trim().length > 0;

  return (
    <article className={`stat-card stat-${accent}`}>
      <p className="stat-label">{label}</p>
      <div className="stat-value-row">
        {showAvatar ? (
          hasAvatar ? (
            <img src={avatar} alt={avatarAlt || String(value ?? '')} className="stat-avatar" loading="lazy" />
          ) : (
            <span className="stat-avatar stat-avatar-fallback" aria-hidden="true">
              {fallback}
            </span>
          )
        ) : null}
        <p className="stat-value">{value}</p>
      </div>
      <p className="stat-subtext">{subtext}</p>
    </article>
  );
}

export default StatCard;

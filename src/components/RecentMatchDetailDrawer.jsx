import { useEffect } from 'react';

const fallbackDetailCopy = {
  title: '对局详情',
  loading: '正在加载对局详情...',
  loadFailed: '对局详情加载失败，请稍后重试。',
  closeAriaLabel: '关闭对局详情',
  openHint: '点击列表行查看详情',
  sections: {
    overview: '基础概览',
    core: '个人核心数据',
    build: '出装与技能',
  },
  labels: {
    result: '结果',
    startTime: '开始时间',
    duration: '时长',
    gameMode: '模式',
    queueType: '队列',
    laneRole: '分路',
    rank: '段位',
    kda: 'K/D/A (KDA)',
    gpmXpm: 'GPM / XPM',
    killParticipation: '参战率',
    impactScore: '表现评级',
    heroDamage: '英雄伤害',
    towerDamage: '建筑伤害',
    heroHealing: '治疗量',
    stunDuration: '控制时长',
    lastHits: '补刀',
    denies: '反补',
    netWorth: '净值',
    level: '等级',
    finalItems: '终局装备',
    neutralItem: '中立道具',
    scepter: '阿哈利姆神杖',
    shard: '阿哈利姆魔晶',
    purchaseTimeline: '出装时间线',
    skillBuild: '技能加点',
  },
  result: {
    win: '胜利',
    loss: '失败',
  },
  units: {
    percent: '%',
    second: '秒',
    minute: '分',
  },
  emptyValue: '-',
};

const formatDateTime = (timestampSec, locale, fallback) => {
  if (!timestampSec) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestampSec * 1000));
};

const formatDuration = (durationSec, fallback) => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return fallback;
  }
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.max(0, Math.floor(durationSec % 60));
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatTimelineTime = (timeSec, fallback) => {
  if (!Number.isFinite(timeSec) || timeSec < 0) {
    return fallback;
  }
  const minutes = Math.floor(timeSec / 60);
  const seconds = Math.max(0, Math.floor(timeSec % 60));
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatNumber = (value, fallback) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return new Intl.NumberFormat().format(value);
};

const formatPercent = (value, copy) => {
  if (!Number.isFinite(value)) {
    return copy.emptyValue;
  }
  return `${value.toFixed(1)}${copy.units.percent}`;
};

const formatKdaLine = (overview, copy) => {
  if (!overview) {
    return copy.emptyValue;
  }
  const kda = Number.isFinite(overview.kda) ? overview.kda.toFixed(2) : copy.emptyValue;
  return `${overview.kills ?? 0}/${overview.deaths ?? 0}/${overview.assists ?? 0} (${kda})`;
};

function RecentMatchDetailDrawer({
  open = false,
  copy = fallbackDetailCopy,
  lang = 'zh',
  match,
  detail,
  loading = false,
  error = '',
  onClose,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const content = detail ?? null;
  const effectiveCopy = copy?.detail ?? fallbackDetailCopy;
  const hero = content?.hero ?? match?.hero ?? effectiveCopy.emptyValue;
  const heroAvatar = content?.heroAvatar ?? match?.heroAvatar ?? '';
  const result = content?.overview?.result ?? match?.result ?? null;

  const overview = content?.overview ?? {};
  const core = content?.core ?? {};
  const build = content?.build ?? {};

  return (
    <div className="match-detail-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="match-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={effectiveCopy.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="match-detail-header">
          <div className="match-detail-title">
            {heroAvatar ? <img src={heroAvatar} alt={hero} className="hero-avatar match-detail-avatar" loading="lazy" /> : null}
            <div>
              <h3>{effectiveCopy.title}</h3>
              <p>
                {hero} · #{content?.matchId ?? match?.matchId ?? effectiveCopy.emptyValue}
              </p>
            </div>
          </div>
          <div className="match-detail-actions">
            {result ? (
              <span className={`result-pill ${result === 'win' ? 'is-win' : 'is-loss'}`}>
                {effectiveCopy.result[result] ?? effectiveCopy.emptyValue}
              </span>
            ) : null}
            <button type="button" className="match-detail-close" onClick={onClose} aria-label={effectiveCopy.closeAriaLabel}>
              ×
            </button>
          </div>
        </header>

        {loading ? <p className="match-detail-state">{effectiveCopy.loading}</p> : null}
        {!loading && error ? <p className="match-detail-state is-error">{error || effectiveCopy.loadFailed}</p> : null}

        {!loading && !error && content ? (
          <div className="match-detail-content">
            <section className="match-detail-section">
              <h4>{effectiveCopy.sections.overview}</h4>
              <div className="match-detail-grid">
                <div>
                  <span>{effectiveCopy.labels.startTime}</span>
                  <strong>{formatDateTime(overview.startTime, locale, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.duration}</span>
                  <strong>{formatDuration(overview.durationSec, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.gameMode}</span>
                  <strong>{overview.gameMode || effectiveCopy.emptyValue}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.queueType}</span>
                  <strong>{overview.queueType || effectiveCopy.emptyValue}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.laneRole}</span>
                  <strong>{overview.laneRole || effectiveCopy.emptyValue}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.rank}</span>
                  <strong>{overview.rank || effectiveCopy.emptyValue}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.kda}</span>
                  <strong>{formatKdaLine(overview, effectiveCopy)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.gpmXpm}</span>
                  <strong>
                    {Number.isFinite(overview.goldPerMin) ? overview.goldPerMin : effectiveCopy.emptyValue} /{' '}
                    {Number.isFinite(overview.xpPerMin) ? overview.xpPerMin : effectiveCopy.emptyValue}
                  </strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.killParticipation}</span>
                  <strong>{formatPercent(overview.killParticipation, effectiveCopy)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.impactScore}</span>
                  <strong>{Number.isFinite(overview.impactScore) ? overview.impactScore : effectiveCopy.emptyValue}</strong>
                </div>
              </div>
            </section>

            <section className="match-detail-section">
              <h4>{effectiveCopy.sections.core}</h4>
              <div className="match-detail-grid">
                <div>
                  <span>{effectiveCopy.labels.heroDamage}</span>
                  <strong>{formatNumber(core.heroDamage, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.towerDamage}</span>
                  <strong>{formatNumber(core.towerDamage, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.heroHealing}</span>
                  <strong>{formatNumber(core.heroHealing, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.stunDuration}</span>
                  <strong>
                    {Number.isFinite(core.stunDuration)
                      ? `${core.stunDuration.toFixed(1)}${effectiveCopy.units.second}`
                      : effectiveCopy.emptyValue}
                  </strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.lastHits}</span>
                  <strong>{formatNumber(core.lastHits, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.denies}</span>
                  <strong>{formatNumber(core.denies, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.netWorth}</span>
                  <strong>{formatNumber(core.netWorth, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.level}</span>
                  <strong>{formatNumber(core.level, effectiveCopy.emptyValue)}</strong>
                </div>
              </div>
            </section>

            <section className="match-detail-section">
              <h4>{effectiveCopy.sections.build}</h4>
              <div className="match-detail-meta-grid">
                <div>
                  <span>{effectiveCopy.labels.scepter}</span>
                  <strong>{formatTimelineTime(build.scepterTimeSec, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.shard}</span>
                  <strong>{formatTimelineTime(build.shardTimeSec, effectiveCopy.emptyValue)}</strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.neutralItem}</span>
                  <strong>{build.neutralItem || effectiveCopy.emptyValue}</strong>
                </div>
              </div>

              <p className="match-detail-list-title">{effectiveCopy.labels.finalItems}</p>
              <div className="match-detail-chip-list">
                {build.finalItems?.length ? (
                  build.finalItems.map((item, index) => (
                    <span key={`${item}-${index}`} className="match-detail-chip">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="empty-text">{effectiveCopy.emptyValue}</span>
                )}
              </div>

              <p className="match-detail-list-title">{effectiveCopy.labels.purchaseTimeline}</p>
              <ul className="match-detail-list">
                {build.purchaseTimeline?.length ? (
                  build.purchaseTimeline.slice(0, 18).map((entry) => (
                    <li key={entry.id}>
                      <span>{formatTimelineTime(entry.timeSec, effectiveCopy.emptyValue)}</span>
                      <strong>{entry.item || effectiveCopy.emptyValue}</strong>
                    </li>
                  ))
                ) : (
                  <li className="empty-text">{effectiveCopy.emptyValue}</li>
                )}
              </ul>

              <p className="match-detail-list-title">{effectiveCopy.labels.skillBuild}</p>
              <ol className="match-detail-list is-ordered">
                {build.skillBuild?.length ? (
                  build.skillBuild.map((entry) => (
                    <li key={entry.id}>
                      <span>L{entry.level}</span>
                      <strong>{entry.ability || effectiveCopy.emptyValue}</strong>
                      <em>{entry.timeSec != null ? formatTimelineTime(entry.timeSec, effectiveCopy.emptyValue) : null}</em>
                    </li>
                  ))
                ) : (
                  <li className="empty-text">{effectiveCopy.emptyValue}</li>
                )}
              </ol>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export default RecentMatchDetailDrawer;

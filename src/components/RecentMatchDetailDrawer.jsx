import { useEffect, useId, useRef, useState } from 'react';
import { toValidUnixDate } from '../utils/date.js';
import { useModalDialog } from './useModalDialog.js';

const fallbackDetailCopy = {
  title: '比赛详情',
  loading: '正在加载比赛详情...',
  loadFailed: '比赛详情加载失败，请稍后重试。',
  retry: '重试',
  retryAfter: (seconds) => `${seconds} 秒后重试`,
  closeAriaLabel: '关闭比赛详情',
  openHint: '点击列表行查看详情',
  partialTitle: '部分详情不可用',
  partialBody: '以下字段使用回退值，其余比赛数据仍可浏览。',
  abilityFallback: '技能名称不可用，当前显示技能数字 ID。',
  profileFallback: '部分玩家公开资料不可用，当前显示回退名称。',
  ownership: {
    notOwned: '未拥有',
    ownedTimingUnknown: '已拥有 · 时间未知',
  },
  sections: {
    overview: '基础概览',
    core: '个人核心数据',
    build: '出装与技能',
    players: '全场玩家',
  },
  labels: {
    result: '结果',
    startTime: '开始时间',
    duration: '时长',
    gameMode: '模式',
    queueType: '队列',
    rank: '玩家段位',
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
    netWorth: '经济 💰',
    level: '等级',
    finalItems: '终局装备',
    neutralItem: '中立道具',
    scepter: '阿哈利姆神杖',
    shard: '阿哈利姆魔晶',
    purchaseTimeline: '出装时间线',
    skillBuild: '技能加点',
    player: '玩家',
    hero: '英雄',
    playerKda: 'K/D/A',
    playerGpmXpm: 'GPM / XPM',
    playerLastHitsDenies: '补刀 / 反补',
    teamKills: '击败',
    teamNetWorth: '总经济 💰',
    playerNetWorth: '经济 💰',
    playerItems: '装备',
    playerDamage: '英雄伤害 / 治疗',
    playerDamageShare: '伤害占比',
    playerRank: '玩家段位',
    currentPlayer: '当前玩家',
  },
  result: {
    win: '胜利',
    loss: '失败',
    unknown: '未知',
  },
  tags: {
    rampage: '暴走',
    godlike: '超神',
    unavailable: '数据不可用',
  },
  units: {
    percent: '%',
    second: '秒',
    minute: '分',
  },
  teams: {
    radiant: '天辉',
    dire: '夜魇',
  },
  scoreboardAriaLabel: (team) => `${team}玩家数据表`,
  emptyValue: '-',
};

const formatDateTime = (timestampSec, locale, fallback) => {
  const date = toValidUnixDate(timestampSec);
  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
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

const formatOwnedItemTiming = (
  { owned, timingAvailable, timeSec },
  copy
) => {
  if (Number.isFinite(timeSec) && timeSec >= 0) {
    return formatTimelineTime(timeSec, copy.emptyValue);
  }
  if (owned === false) {
    return copy.ownership?.notOwned ?? fallbackDetailCopy.ownership.notOwned;
  }
  if (owned === true || timingAvailable === false) {
    return (
      copy.ownership?.ownedTimingUnknown ??
      fallbackDetailCopy.ownership.ownedTimingUnknown
    );
  }
  return copy.emptyValue;
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
  return `${formatNumber(overview.kills, copy.emptyValue)}/${formatNumber(overview.deaths, copy.emptyValue)}/${formatNumber(overview.assists, copy.emptyValue)} (${kda})`;
};

const formatPlayerKda = (player, copy) => {
  const kda = Number.isFinite(player.kda) ? player.kda.toFixed(2) : copy.emptyValue;
  return `${formatNumber(player.kills, copy.emptyValue)}/${formatNumber(player.deaths, copy.emptyValue)}/${formatNumber(player.assists, copy.emptyValue)} (${kda})`;
};
const formatAchievementTagLabel = (label, count) => (count > 1 ? `${label} x${count}` : label);

const getResultTone = (result) => {
  if (result === 'win') {
    return 'is-win';
  }
  if (result === 'loss') {
    return 'is-loss';
  }
  return 'is-unknown';
};

const getAvatarInitial = (name, fallback = '?') => {
  const text = String(name ?? '').trim();
  if (!text) {
    return fallback;
  }
  return text.slice(0, 1).toUpperCase();
};

function PlayerScoreboardSection({ radiantPlayers, direPlayers, copy }) {
  const teams = [
    { key: 'radiant', label: copy.teams?.radiant || fallbackDetailCopy.teams.radiant, players: radiantPlayers },
    { key: 'dire', label: copy.teams?.dire || fallbackDetailCopy.teams.dire, players: direPlayers },
  ];

  return (
    <section className="match-detail-section match-player-section">
      <div className="match-player-section-head">
        <h4>{copy.sections.players}</h4>
      </div>
      <div className="match-player-team-grid">
        {teams.map((team) => {
          const teamKills = team.players.reduce((sum, player) => sum + (player.kills ?? 0), 0);
          const teamNetWorth = team.players.reduce((sum, player) => sum + (player.netWorth ?? 0), 0);
          const scoreboardLabel =
            typeof copy.scoreboardAriaLabel === 'function'
              ? copy.scoreboardAriaLabel(team.label)
              : fallbackDetailCopy.scoreboardAriaLabel(team.label);

          return (
            <article key={team.key} className={`match-player-team is-${team.key}`}>
              <div className="match-player-team-head">
                <p className="match-player-team-title">{team.label}</p>
                <div className="match-player-team-metrics">
                  <span>
                    {copy.labels.teamKills} {teamKills}
                  </span>
                  <span>
                    {copy.labels.teamNetWorth} {formatNumber(teamNetWorth, copy.emptyValue)}
                  </span>
                </div>
              </div>
              {team.players.length ? (
                <div className="match-player-scoreboard-wrap" role="region" aria-label={scoreboardLabel} tabIndex={0}>
                  <table className="match-player-scoreboard-table">
                    <caption className="sr-only">{scoreboardLabel}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="col-player">
                          {copy.labels.player}
                        </th>
                        <th scope="col" className="col-kda">
                          {copy.labels.playerKda}
                        </th>
                        <th scope="col" className="col-gpm-xpm">
                          {copy.labels.playerGpmXpm}
                        </th>
                        <th scope="col" className="col-net-worth">
                          {copy.labels.playerNetWorth}
                        </th>
                        <th scope="col" className="col-items">
                          {copy.labels.playerItems}
                        </th>
                        <th scope="col" className="col-damage">
                          {copy.labels.playerDamage}
                        </th>
                        <th scope="col" className="col-participation">
                          {copy.labels.killParticipation} / {copy.labels.playerDamageShare}
                        </th>
                        <th scope="col" className="col-last-hits">
                          {copy.labels.playerLastHitsDenies}
                        </th>
                        <th scope="col" className="col-rank">
                          {copy.labels.playerRank}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.players.map((player) => (
                        <tr
                          key={player.id}
                          className={player.isCurrentPlayer ? 'is-current' : ''}
                          aria-current={player.isCurrentPlayer ? 'true' : undefined}
                        >
                          <td className="col-player">
                            <div className="hero-name-cell">
                              {player.heroAvatar ? (
                                <img src={player.heroAvatar} alt="" className="hero-avatar" loading="lazy" />
                              ) : null}
                              <strong>{player.hero || copy.emptyValue}</strong>
                            </div>
                            <div className="match-player-name">
                              {player.playerAvatar ? (
                                <img src={player.playerAvatar} alt="" className="player-avatar" loading="lazy" />
                              ) : (
                                <span className="player-avatar is-fallback" aria-hidden="true">
                                  {getAvatarInitial(player.playerName, copy.emptyValue)}
                                </span>
                              )}
                              <span className="match-player-name-text">{player.playerName || copy.emptyValue}</span>
                              {player.isCurrentPlayer ? (
                                <em className="match-player-current-tag">{copy.labels.currentPlayer}</em>
                              ) : null}
                            </div>
                          </td>
                          <td className="tabular-number col-kda">{formatPlayerKda(player, copy)}</td>
                          <td className="tabular-number col-gpm-xpm">
                            {Number.isFinite(player.goldPerMin) ? player.goldPerMin : copy.emptyValue} /{' '}
                            {Number.isFinite(player.xpPerMin) ? player.xpPerMin : copy.emptyValue}
                          </td>
                          <td className="tabular-number col-net-worth">{formatNumber(player.netWorth, copy.emptyValue)}</td>
                          <td className="col-items">
                            <div className="match-player-items-cell">
                              {player.items?.length ? (
                                player.items.slice(0, 7).map((item, index) =>
                                  item.icon ? (
                                    <img
                                      key={`${item.id}-${index}`}
                                      src={item.icon}
                                      alt={item.name}
                                      title={item.name}
                                      className={`player-item-icon ${item.isNeutral ? 'is-neutral' : ''}`}
                                      loading="lazy"
                                    />
                                  ) : (
                                    <span key={`${item.id}-${index}`} className="player-item-fallback" title={item.name}>
                                      {String(item.name ?? copy.emptyValue).slice(0, 2)}
                                    </span>
                                  )
                                )
                              ) : (
                                <span className="empty-text">{copy.emptyValue}</span>
                              )}
                            </div>
                          </td>
                          <td className="tabular-number col-damage">
                            {formatNumber(player.heroDamage, copy.emptyValue)} / {formatNumber(player.heroHealing, copy.emptyValue)}
                          </td>
                          <td className="tabular-number col-participation">
                            {formatPercent(player.killParticipation, copy)} / {formatPercent(player.damageShare, copy)}
                          </td>
                          <td className="tabular-number col-last-hits">
                            {formatNumber(player.lastHits, copy.emptyValue)} / {formatNumber(player.denies, copy.emptyValue)}
                          </td>
                          <td className="col-rank">{player.rank || copy.emptyValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-text">{copy.emptyValue}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RecentMatchDetailDrawer({
  open = false,
  copy = fallbackDetailCopy,
  lang = 'zh',
  match,
  detail,
  loading = false,
  error = '',
  onClose,
  onRetry,
}) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const dialogRef = useModalDialog({ open, onClose, initialFocusRef: closeButtonRef });
  const errorMessage =
    typeof error === 'string' ? error : error?.message || '';
  const errorRetryable =
    typeof error === 'object' && error !== null ? error.retryable !== false : true;
  const errorRetryAfter =
    typeof error === 'object' && error !== null && Number.isFinite(error.retryAfter)
      ? error.retryAfter
      : null;
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0);

  useEffect(() => {
    if (!errorMessage || !Number.isFinite(errorRetryAfter) || errorRetryAfter <= 0) {
      setRetryDelaySeconds(0);
      return undefined;
    }
    setRetryDelaySeconds(Math.ceil(errorRetryAfter));
    const timer = window.setInterval(() => {
      setRetryDelaySeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [errorMessage, errorRetryAfter]);

  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const content = detail ?? null;
  const effectiveCopy = copy?.detail ?? fallbackDetailCopy;
  const hero = content?.hero ?? match?.hero ?? effectiveCopy.emptyValue;
  const heroAvatar = content?.heroAvatar ?? match?.heroAvatar ?? '';
  const result = content?.overview?.result ?? match?.result ?? null;
  const retryWaiting = errorRetryable && retryDelaySeconds > 0;
  const retryText =
    retryWaiting && typeof effectiveCopy.retryAfter === 'function'
      ? effectiveCopy.retryAfter(retryDelaySeconds)
      : effectiveCopy.retry || fallbackDetailCopy.retry;

  const overview = content?.overview ?? {};
  const core = content?.core ?? {};
  const build = content?.build ?? {};
  const allPlayers = Array.isArray(content?.allPlayers) ? content.allPlayers : [];
  const radiantPlayers = allPlayers.filter((item) => item.team === 'radiant');
  const direPlayers = allPlayers.filter((item) => item.team === 'dire');
  const rampageCount = Number.isFinite(overview.rampageCount)
    ? Math.max(0, Math.trunc(overview.rampageCount))
    : overview.hasRampage
      ? 1
      : 0;
  const godlikeCount = Number.isFinite(overview.godlikeCount)
    ? Math.max(0, Math.trunc(overview.godlikeCount))
    : overview.hasGodlike
      ? 1
      : 0;
  const achievementTags = [
    rampageCount > 0
      ? {
          key: 'rampage',
          label: formatAchievementTagLabel(effectiveCopy.tags?.rampage || fallbackDetailCopy.tags.rampage, rampageCount),
        }
      : overview.rampageDataAvailable === false
        ? {
            key: 'rampage-unavailable',
            unavailable: true,
            label: `${effectiveCopy.tags?.rampage || fallbackDetailCopy.tags.rampage} · ${effectiveCopy.tags?.unavailable || fallbackDetailCopy.tags.unavailable}`,
          }
      : null,
    godlikeCount > 0
      ? {
          key: 'godlike',
          label: formatAchievementTagLabel(effectiveCopy.tags?.godlike || fallbackDetailCopy.tags.godlike, godlikeCount),
        }
      : overview.godlikeDataAvailable === false
        ? {
            key: 'godlike-unavailable',
            unavailable: true,
            label: `${effectiveCopy.tags?.godlike || fallbackDetailCopy.tags.godlike} · ${effectiveCopy.tags?.unavailable || fallbackDetailCopy.tags.unavailable}`,
          }
      : null,
  ].filter(Boolean);
  const accessIssues = Array.isArray(content?.accessIssues)
    ? content.accessIssues
    : [];
  const hasAbilityFallback = Array.isArray(build.skillBuild)
    ? build.skillBuild.some((entry) => entry?.abilityNameAvailable === false)
    : false;
  const issueMessages = accessIssues
    .map((issue) => issue?.message || issue?.code)
    .filter(Boolean);
  const hasAbilityIssue = accessIssues.some(
    (issue) =>
      issue?.slice === 'abilityNames' ||
      String(issue?.code ?? '').startsWith('ABILITY_')
  );
  if (
    hasAbilityFallback &&
    !hasAbilityIssue
  ) {
    issueMessages.push(
      effectiveCopy.abilityFallback ?? fallbackDetailCopy.abilityFallback
    );
  }
  const hasProfileCoverageGap =
    content?.dataCoverage?.playerProfiles?.complete === false;
  const hasProfileIssue = accessIssues.some(
    (issue) =>
      issue?.slice === 'playerProfiles' ||
      String(issue?.code ?? '').startsWith('PLAYER_PROFILE')
  );
  if (hasProfileCoverageGap && !hasProfileIssue) {
    issueMessages.push(
      effectiveCopy.profileFallback ?? fallbackDetailCopy.profileFallback
    );
  }
  const hasPartialData =
    content?.partial === true ||
    hasProfileCoverageGap ||
    issueMessages.length > 0;

  return (
    <dialog
      ref={dialogRef}
      className="match-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="match-detail-drawer"
      >
        <header className="match-detail-header">
          <div className="match-detail-title">
            {heroAvatar ? <img src={heroAvatar} alt="" className="hero-avatar match-detail-avatar" loading="lazy" /> : null}
            <div>
              <h3 id={titleId}>{effectiveCopy.title}</h3>
              <p>
                {hero} · #{content?.matchId ?? match?.matchId ?? effectiveCopy.emptyValue}
              </p>
            </div>
          </div>
          <div className="match-detail-actions">
            {result ? (
              <span className={`result-pill ${getResultTone(result)}`}>
                {effectiveCopy.result[result] ?? effectiveCopy.emptyValue}
              </span>
            ) : null}
            {achievementTags.map((tag) => (
              <span
                key={tag.key}
                className={`detail-achievement-tag ${tag.unavailable ? 'is-unavailable' : `is-${tag.key}`}`}
              >
                {tag.label}
              </span>
            ))}
            <button
              ref={closeButtonRef}
              type="button"
              className="match-detail-close"
              onClick={onClose}
              aria-label={effectiveCopy.closeAriaLabel}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        {loading ? (
          <p className="match-detail-state" role="status" aria-live="polite">
            {effectiveCopy.loading}
          </p>
        ) : null}
        {!loading && errorMessage ? (
          <div className="match-detail-state-row" role="alert">
            <p className="match-detail-state is-error">{errorMessage || effectiveCopy.loadFailed}</p>
            {onRetry && errorRetryable ? (
              <button
                type="button"
                className="match-detail-retry"
                disabled={retryWaiting}
                onClick={() => {
                  closeButtonRef.current?.focus();
                  onRetry();
                }}
              >
                {retryText}
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !errorMessage && content ? (
          <div className="match-detail-content">
            {hasPartialData ? (
              <section className="match-detail-partial" role="status">
                <strong>
                  {effectiveCopy.partialTitle ?? fallbackDetailCopy.partialTitle}
                </strong>
                <p>
                  {effectiveCopy.partialBody ?? fallbackDetailCopy.partialBody}
                </p>
                {issueMessages.length > 0 ? (
                  <ul>
                    {issueMessages.map((message, index) => (
                      <li key={`${String(message)}-${index}`}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
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
                  <strong>
                    {formatOwnedItemTiming(
                      {
                        owned: build.scepterOwned,
                        timingAvailable: build.scepterTimingAvailable,
                        timeSec: build.scepterTimeSec,
                      },
                      effectiveCopy
                    )}
                  </strong>
                </div>
                <div>
                  <span>{effectiveCopy.labels.shard}</span>
                  <strong>
                    {formatOwnedItemTiming(
                      {
                        owned: build.shardOwned,
                        timingAvailable: build.shardTimingAvailable,
                        timeSec: build.shardTimeSec,
                      },
                      effectiveCopy
                    )}
                  </strong>
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

            <PlayerScoreboardSection radiantPlayers={radiantPlayers} direPlayers={direPlayers} copy={effectiveCopy} />
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

export default RecentMatchDetailDrawer;

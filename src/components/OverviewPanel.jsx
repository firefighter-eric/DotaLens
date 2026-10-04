import { useMemo } from 'react';
import StatCard from './StatCard.jsx';
import RankDistribution from './RankDistribution.jsx';
import GameModeDistributionPie from './GameModeDistributionPie.jsx';
import OverviewHeroFocus from './OverviewHeroFocus.jsx';
import OverviewRecentMatches from './OverviewRecentMatches.jsx';
import CoachPanel from './CoachPanel.jsx';
import { buildGameModeDistribution, resolveHeroWinRate, summarizeOverviewExtremes, summarizeSideWinRates } from '../utils/metrics.js';
import { buildCoachInsights } from '../utils/coachInsights.js';
import { toFiniteOrNull, formatIntegerDisplay, formatMatchDateTime, formatEntryValue } from '../utils/display.js';
import { TAB_IDS, panelLabelId } from '../config/workspace.js';

export default function OverviewPanel({ dashboard, copy, lang, days, setDays, setActiveTab, selectableMatchesById, selectedRecentMatchId, handleOpenRecentMatchDetail }) {
  const coachInsights = useMemo(
    () =>
      buildCoachInsights({
        heroPerformance: dashboard.heroPerformance,
        windowMatches: dashboard.windowMatches,
      }),
    [dashboard.heroPerformance, dashboard.windowMatches]
  );
  const overviewFeaturedHeroes = useMemo(
    () =>
      (dashboard.heroPerformance ?? [])
        .slice()
        .sort((left, right) => {
          const matchDelta = (right.matches ?? 0) - (left.matches ?? 0);
          if (matchDelta !== 0) {
            return matchDelta;
          }
          return (resolveHeroWinRate(right) ?? -1) - (resolveHeroWinRate(left) ?? -1);
        })
        .slice(0, 5),
    [dashboard.heroPerformance]
  );
  const overviewHeroInsight =
    coachInsights.find((insight) => insight.id === 'heroFocus') ?? coachInsights[0] ?? null;
  const overviewRecentMatches = useMemo(
    () => (dashboard.windowMatches ?? []).slice(0, 5),
    [dashboard.windowMatches]
  );
  const overviewExtremeMatches = useMemo(() => dashboard.windowMatches ?? [], [dashboard.windowMatches]);
  const overviewExtremes = useMemo(() => summarizeOverviewExtremes(overviewExtremeMatches), [overviewExtremeMatches]);
  const overviewAchievementTotals = useMemo(() => {
    if (dashboard.achievementTotals) {
      const normalizeCoverage = (coverage) => ({
        availableMatches: Math.max(0, Math.trunc(toFiniteOrNull(coverage?.availableMatches) ?? 0)),
        totalMatches: Math.max(0, Math.trunc(toFiniteOrNull(coverage?.totalMatches) ?? 0)),
        ratio: Math.max(0, Math.min(1, toFiniteOrNull(coverage?.ratio) ?? 0)),
        complete: coverage?.complete === true,
      });
      return {
        rampage: Math.max(0, Math.trunc(toFiniteOrNull(dashboard.achievementTotals.rampage) ?? 0)),
        godlike: Math.max(0, Math.trunc(toFiniteOrNull(dashboard.achievementTotals.godlike) ?? 0)),
        rampageDataAvailable: dashboard.achievementTotals.rampageDataAvailable === true,
        godlikeDataAvailable: dashboard.achievementTotals.godlikeDataAvailable === true,
        rampagePartialDataAvailable: dashboard.achievementTotals.rampagePartialDataAvailable === true,
        godlikePartialDataAvailable: dashboard.achievementTotals.godlikePartialDataAvailable === true,
        rampageCoverage: normalizeCoverage(dashboard.achievementTotals.rampageCoverage),
        godlikeCoverage: normalizeCoverage(dashboard.achievementTotals.godlikeCoverage),
      };
    }

    const fallbackTotals = (dashboard.windowMatches ?? []).reduce(
      (acc, match) => {
        const rampageCount = toFiniteOrNull(match?.rampageCount);
        const godlikeCount = toFiniteOrNull(match?.godlikeCount);
        const rampageDataAvailable = match?.rampageDataAvailable === true || (rampageCount != null && rampageCount > 0);
        const godlikeDataAvailable = match?.godlikeDataAvailable === true || (godlikeCount != null && godlikeCount > 0);
        acc.rampage += rampageCount == null ? (match?.hasRampage ? 1 : 0) : Math.max(0, Math.trunc(rampageCount));
        acc.godlike += godlikeCount == null ? (match?.hasGodlike ? 1 : 0) : Math.max(0, Math.trunc(godlikeCount));
        acc.rampageAvailableMatches += rampageDataAvailable ? 1 : 0;
        acc.godlikeAvailableMatches += godlikeDataAvailable ? 1 : 0;
        return acc;
      },
      { rampage: 0, godlike: 0, rampageAvailableMatches: 0, godlikeAvailableMatches: 0 }
    );
    const totalMatches = dashboard.windowMatches?.length ?? 0;
    const makeCoverage = (availableMatches) => ({
      availableMatches,
      totalMatches,
      ratio: totalMatches > 0 ? availableMatches / totalMatches : 1,
      complete: availableMatches === totalMatches,
    });
    const rampageCoverage = makeCoverage(fallbackTotals.rampageAvailableMatches);
    const godlikeCoverage = makeCoverage(fallbackTotals.godlikeAvailableMatches);
    return {
      rampage: fallbackTotals.rampage,
      godlike: fallbackTotals.godlike,
      rampageDataAvailable: rampageCoverage.complete,
      godlikeDataAvailable: godlikeCoverage.complete,
      rampagePartialDataAvailable: rampageCoverage.availableMatches > 0 && !rampageCoverage.complete,
      godlikePartialDataAvailable: godlikeCoverage.availableMatches > 0 && !godlikeCoverage.complete,
      rampageCoverage,
      godlikeCoverage,
    };
  }, [dashboard.achievementTotals, dashboard.windowMatches]);
  const overviewGameModeDistribution = useMemo(
    () => buildGameModeDistribution(dashboard.windowMatches, copy.overview.modeDistribution.unknownMode),
    [dashboard.windowMatches, copy.overview.modeDistribution.unknownMode]
  );
  const sideWinRates = useMemo(() => summarizeSideWinRates(dashboard.windowMatches ?? []), [dashboard.windowMatches]);
  const worstHero = dashboard.metrics.worstHero;
  const mostPlayedHero = dashboard.metrics.mostPlayedHero;
  const signatureHero = dashboard.metrics.signatureHero;
  const antiSignatureHero = dashboard.metrics.antiSignatureHero;
  const emptyValue = copy.recentMatches.emptyValue;
  const avgGpm = Number.isFinite(dashboard.metrics.avgGpm) ? dashboard.metrics.avgGpm : copy.recentMatches.emptyValue;
  const avgXpm = Number.isFinite(dashboard.metrics.avgXpm) ? dashboard.metrics.avgXpm : copy.recentMatches.emptyValue;
  const resolvedWorstHeroWinRate = resolveHeroWinRate(worstHero);
  const worstHeroWinRate =
    resolvedWorstHeroWinRate === null ? null : resolvedWorstHeroWinRate.toFixed(1);
  const formatAchievementValue = (value, complete, partial) =>
    complete ? value : partial ? `≥ ${value}` : emptyValue;
  const formatAchievementSubtext = (coverage, defaultText) => {
    if (coverage?.complete) {
      return defaultText;
    }
    if (typeof copy.cards.achievementCoverageSubtext === 'function') {
      return copy.cards.achievementCoverageSubtext({
        availableMatches: coverage?.availableMatches ?? 0,
        totalMatches: coverage?.totalMatches ?? 0,
      });
    }
    return `${coverage?.availableMatches ?? 0} / ${coverage?.totalMatches ?? 0}`;
  };
  const highestDamageMatch = overviewExtremes.highestDamageMatch;
  const mostKillsMatch = overviewExtremes.mostKillsMatch;
  const mostDeathsMatch = overviewExtremes.mostDeathsMatch;
  const overviewExtremeRows = [
    { id: 'highestDamage', label: copy.cards.highestDamageMatch, match: highestDamageMatch },
    { id: 'mostKills', label: copy.cards.mostKillsMatch, match: mostKillsMatch },
    { id: 'mostDeaths', label: copy.cards.mostDeathsMatch, match: mostDeathsMatch },
  ].filter((item) => item.match);
  const teammateSummary = dashboard.teammateSummary ?? {};
  const mostPlayedTeammate = teammateSummary.mostPlayed ?? null;
  const bestWinRateTeammate = teammateSummary.bestWinRateOver20 ?? null;
  const worstWinRateTeammate = teammateSummary.worstWinRateOver20 ?? null;
  const radiantWinRateText = sideWinRates.radiant.winRate === null ? emptyValue : `${sideWinRates.radiant.winRate}%`;
  const direWinRateText = sideWinRates.dire.winRate === null ? emptyValue : `${sideWinRates.dire.winRate}%`;
  const overallWinRateText =
    dashboard.metrics.overallWinRate == null
      ? emptyValue
      : `${dashboard.metrics.overallWinRate}%`;

  return (
          <section
            id={`panel-${TAB_IDS.overview}`}
            role="region"
            aria-labelledby={panelLabelId(TAB_IDS.overview)}
            className="tab-content"
          >
            <section className="overview-scoreboard" aria-label={copy.overview.performanceSnapshotTitle}>
              <div className="overview-scoreboard__toolbar">
                <h2 className="sr-only">{copy.overview.performanceSnapshotTitle}</h2>
                <div className="range-switch overview-range-switch" role="group" aria-label={copy.query.rangeAriaLabel}>
                  <button
                    type="button"
                    className={days === 30 ? 'is-active' : ''}
                    onClick={() => setDays(30)}
                    aria-pressed={days === 30}
                  >
                    {copy.query.day30}
                  </button>
                  <button
                    type="button"
                    className={days === 365 ? 'is-active' : ''}
                    onClick={() => setDays(365)}
                    aria-pressed={days === 365}
                  >
                    {copy.query.day365}
                  </button>
                </div>
              </div>

              <div className="stats-grid overview-scoreboard__grid">
                <StatCard
                  label={copy.cards.totalMatches}
                  value={dashboard.metrics.totalMatches}
                  subtext={copy.cards.totalMatchesSubtext(days)}
                  accent="gold"
                />
                <StatCard
                  label={copy.cards.overallWinRate}
                  value={overallWinRateText}
                  subtext={copy.cards.overallWinRateSubtext}
                  accent="teal"
                />
                <StatCard
                  label={copy.cards.sideWinRate}
                  value={`${radiantWinRateText} / ${direWinRateText}`}
                  subtext={copy.cards.sideWinRateSubtext({
                    radiantMatches: sideWinRates.radiant.matches,
                    direMatches: sideWinRates.dire.matches,
                  })}
                  accent="teal"
                />
                <StatCard
                  label={copy.cards.avgKda}
                  value={dashboard.metrics.avgKda ?? emptyValue}
                  subtext={copy.cards.avgKdaSubtext}
                  accent="red"
                />
                <StatCard
                  label={copy.cards.avgGpm}
                  value={`${avgGpm} / ${avgXpm}`}
                  subtext={copy.cards.avgGpmSubtext}
                  accent="blue"
                />
                <StatCard
                  label={copy.cards.mostPlayedHero}
                  value={mostPlayedHero.hero}
                  subtext={copy.cards.mostPlayedHeroSubtext({
                    matches: mostPlayedHero.matches,
                    outcomeMatches: mostPlayedHero.outcomeMatches,
                    winRate: mostPlayedHero.winRate,
                  })}
                  accent="gold"
                  showAvatar
                  avatar={mostPlayedHero.heroAvatar}
                  avatarAlt={mostPlayedHero.hero}
                />
                <StatCard
                  label={copy.cards.worstHero}
                  value={worstHero.hero}
                  subtext={copy.cards.worstHeroSubtext({
                    matches: worstHero.matches ?? 0,
                    outcomeMatches: worstHero.outcomeMatches,
                    winRate: worstHeroWinRate,
                  })}
                  accent="red"
                  showAvatar
                  avatar={worstHero.heroAvatar}
                  avatarAlt={worstHero.hero}
                />
              </div>
            </section>

            <section className="overview-main-grid">
              <OverviewHeroFocus
                heroes={overviewFeaturedHeroes}
                insight={overviewHeroInsight}
                coachCopy={copy.coach}
                tableCopy={{ ...copy.table, ...copy.overview }}
                onViewAll={() => setActiveTab(TAB_IDS.heroes)}
                viewAllLabel={copy.overview.heroFocusCta}
              />
              <CoachPanel
                insights={coachInsights}
                days={days}
                copy={copy.coach}
                lang={lang}
                matchesById={selectableMatchesById}
                onSelectMatch={handleOpenRecentMatchDetail}
              />
            </section>

            <OverviewRecentMatches
              matches={overviewRecentMatches}
              copy={copy.recentMatches}
              lang={lang}
              selectedMatchId={selectedRecentMatchId}
              onSelectMatch={handleOpenRecentMatchDetail}
              title={copy.overview.recentMatchesTitle}
            />

            <details className="overview-secondary">
              <summary>{copy.overview.moreStatsTitle}</summary>
              <div className="overview-secondary__content">
            <section className="stats-grid overview-secondary-stats">
              <StatCard
                label={copy.cards.totalMatches}
                value={dashboard.metrics.totalMatches}
                subtext={copy.cards.totalMatchesSubtext(days)}
                accent="gold"
              />
              <StatCard
                label={copy.cards.overallWinRate}
                value={overallWinRateText}
                subtext={copy.cards.overallWinRateSubtext}
                accent="teal"
              />
              <StatCard
                label={copy.cards.sideWinRate}
                value={`${radiantWinRateText} / ${direWinRateText}`}
                subtext={copy.cards.sideWinRateSubtext({
                  radiantMatches: sideWinRates.radiant.matches,
                  direMatches: sideWinRates.dire.matches,
                })}
                accent="teal"
              />
              <StatCard
                label={copy.cards.avgKda}
                value={dashboard.metrics.avgKda ?? emptyValue}
                subtext={copy.cards.avgKdaSubtext}
                accent="red"
              />
              <StatCard
                label={copy.cards.avgGpm}
                value={`${avgGpm} / ${avgXpm}`}
                subtext={copy.cards.avgGpmSubtext}
                accent="blue"
              />
              <StatCard
                label={copy.cards.signatureHero}
                value={signatureHero.hero}
                subtext={copy.cards.signatureHeroSubtext({
                  matches: signatureHero.matches,
                  outcomeMatches: signatureHero.outcomeMatches,
                  winRate: signatureHero.winRate,
                })}
                accent="blue"
                showAvatar
                avatar={signatureHero.heroAvatar}
                avatarAlt={signatureHero.hero}
              />
              <StatCard
                label={copy.cards.mostPlayedHero}
                value={mostPlayedHero.hero}
                subtext={copy.cards.mostPlayedHeroSubtext({
                  matches: mostPlayedHero.matches,
                  outcomeMatches: mostPlayedHero.outcomeMatches,
                  winRate: mostPlayedHero.winRate,
                })}
                accent="teal"
                showAvatar
                avatar={mostPlayedHero.heroAvatar}
                avatarAlt={mostPlayedHero.hero}
              />
              <StatCard
                label={copy.cards.worstHero}
                value={worstHero.hero}
                subtext={copy.cards.worstHeroSubtext({
                  matches: worstHero.matches ?? 0,
                  outcomeMatches: worstHero.outcomeMatches,
                  winRate: worstHeroWinRate,
                })}
                accent="red"
                showAvatar
                avatar={worstHero.heroAvatar}
                avatarAlt={worstHero.hero}
              />
              <StatCard
                label={copy.cards.antiSignatureHero}
                value={antiSignatureHero.hero}
                subtext={copy.cards.antiSignatureHeroSubtext({
                  matches: antiSignatureHero.matches,
                  outcomeMatches: antiSignatureHero.outcomeMatches,
                  winRate: antiSignatureHero.winRate,
                })}
                accent="red"
                showAvatar
                avatar={antiSignatureHero.heroAvatar}
                avatarAlt={antiSignatureHero.hero}
              />
              <StatCard
                label={copy.cards.longestWinStreak}
                value={dashboard.metrics.longestWinStreak}
                subtext={copy.cards.longestWinStreakSubtext(days)}
                accent="gold"
              />
              <StatCard
                label={copy.cards.longestLossStreak}
                value={dashboard.metrics.longestLossStreak}
                subtext={copy.cards.longestLossStreakSubtext(days)}
                accent="red"
              />
              <StatCard
                label={copy.cards.rampageCount}
                value={formatAchievementValue(
                  overviewAchievementTotals.rampage,
                  overviewAchievementTotals.rampageDataAvailable,
                  overviewAchievementTotals.rampagePartialDataAvailable
                )}
                subtext={formatAchievementSubtext(
                  overviewAchievementTotals.rampageCoverage,
                  copy.cards.rampageCountSubtext(days)
                )}
                accent="red"
              />
              <StatCard
                label={copy.cards.godlikeCount}
                value={formatAchievementValue(
                  overviewAchievementTotals.godlike,
                  overviewAchievementTotals.godlikeDataAvailable,
                  overviewAchievementTotals.godlikePartialDataAvailable
                )}
                subtext={formatAchievementSubtext(
                  overviewAchievementTotals.godlikeCoverage,
                  copy.cards.godlikeCountSubtext(days)
                )}
                accent="gold"
              />
              <StatCard
                label={copy.cards.mostPlayedTeammate}
                value={mostPlayedTeammate?.playerName ?? copy.recentMatches.emptyValue}
                subtext={
                  mostPlayedTeammate
                    ? copy.cards.mostPlayedTeammateSubtext({ matches: mostPlayedTeammate.matches })
                    : copy.cards.teammateNoData
                }
                accent="teal"
                showAvatar
                avatar={mostPlayedTeammate?.playerAvatar ?? ''}
                avatarAlt={mostPlayedTeammate?.playerName ?? copy.recentMatches.emptyValue}
              />
              <StatCard
                label={copy.cards.bestWinRateTeammate}
                value={bestWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
                subtext={
                  bestWinRateTeammate
                    ? copy.cards.bestWinRateTeammateSubtext({
                        winRate: bestWinRateTeammate.winRate,
                        matches: bestWinRateTeammate.matches,
                      })
                    : copy.cards.teammateNoData
                }
                accent="gold"
                showAvatar
                avatar={bestWinRateTeammate?.playerAvatar ?? ''}
                avatarAlt={bestWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
              />
              <StatCard
                label={copy.cards.worstWinRateTeammate}
                value={worstWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
                subtext={
                  worstWinRateTeammate
                    ? copy.cards.worstWinRateTeammateSubtext({
                        winRate: worstWinRateTeammate.winRate,
                        matches: worstWinRateTeammate.matches,
                      })
                    : copy.cards.teammateNoData
                }
                accent="red"
                showAvatar
                avatar={worstWinRateTeammate?.playerAvatar ?? ''}
                avatarAlt={worstWinRateTeammate?.playerName ?? copy.recentMatches.emptyValue}
              />
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>{copy.overview.extremeMatchesTitle}</h2>
                <span className="panel-tag">{copy.overview.tag(days)}</span>
              </div>
              {overviewExtremeRows.length > 0 ? (
                <div className="table-wrap recent-table-wrap">
                  <table className="recent-table">
                    <thead>
                      <tr>
                        <th>{copy.overview.extremeMetricHeader}</th>
                        <th>{copy.recentMatches.headers.date}</th>
                        <th>{copy.recentMatches.headers.hero}</th>
                        <th>{copy.recentMatches.headers.result}</th>
                        <th>{copy.recentMatches.headers.kda}</th>
                        <th>{copy.overview.extremeValueHeader}</th>
                        <th>{copy.recentMatches.headers.matchId}</th>
                        <th>
                          <span className="sr-only">{copy.recentMatches.openMatch}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewExtremeRows.map((item) => {
                        const match = item.match;
                        const resultLabel = copy.recentMatches.result?.[match.result] ?? emptyValue;
                        const rowClassName = `recent-row ${selectedRecentMatchId === match.matchId ? 'is-selected' : ''}`;
                        const dateText = formatMatchDateTime(match.startTime, lang, emptyValue);
                        const kdaLine = `${formatEntryValue(match.kills, emptyValue)}/${formatEntryValue(match.deaths, emptyValue)}/${formatEntryValue(
                          match.assists,
                          emptyValue
                        )}`;
                        const openAriaLabel = copy.recentMatches.openMatchAriaLabel({
                          hero: match.hero || emptyValue,
                          result: resultLabel,
                          date: dateText,
                        });

                        return (
                          <tr key={`${item.id}-${match.matchId}`} className={rowClassName}>
                            <td>{item.label}</td>
                            <td>{dateText}</td>
                            <td>
                              <div className="hero-name-cell">
                                {match.heroAvatar ? (
                                  <img src={match.heroAvatar} alt="" className="hero-avatar" loading="lazy" />
                                ) : null}
                                <span>{match.hero || emptyValue}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`result-pill ${
                                  match.result === 'win'
                                    ? 'is-win'
                                    : match.result === 'loss'
                                      ? 'is-loss'
                                      : 'is-unknown'
                                }`}
                              >
                                {resultLabel}
                              </span>
                            </td>
                            <td>{kdaLine}</td>
                            <td>{formatIntegerDisplay(match.value, lang, emptyValue)}</td>
                            <td>{match.matchId ?? emptyValue}</td>
                            <td className="table-action-cell">
                              <button
                                type="button"
                                className="table-row-action"
                                onClick={() => handleOpenRecentMatchDetail(match)}
                                aria-label={openAriaLabel}
                                aria-pressed={selectedRecentMatchId === match.matchId}
                              >
                                {copy.recentMatches.openMatch}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-text">{copy.overview.extremeMatchesEmpty}</p>
              )}
            </section>

            <section className="two-cols">
              <RankDistribution
                items={dashboard.rankDistribution}
                coverage={dashboard.rankDistributionCoverage}
                days={days}
                copy={copy.rank}
              />
              <GameModeDistributionPie items={overviewGameModeDistribution} days={days} copy={copy.overview.modeDistribution} />
            </section>
              </div>
            </details>
          </section>
  );
}

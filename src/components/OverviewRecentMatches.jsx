import { useId } from 'react';
import { toValidUnixDate } from '../utils/date.js';

const EMPTY_VALUE = '-';
const RESULT_TONES = new Set(['win', 'loss']);

const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatInteger = (value) => {
  const number = toFiniteOrNull(value);
  return number === null ? EMPTY_VALUE : String(Math.round(number));
};

const formatDuration = (durationSec) => {
  const seconds = toFiniteOrNull(durationSec);
  if (seconds === null || seconds <= 0) {
    return EMPTY_VALUE;
  }
  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainder = roundedSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const resolveResultTone = (result) =>
  RESULT_TONES.has(result) ? result : 'unknown';

const resolveMatchTime = (match) => {
  const startDate = toValidUnixDate(match?.startTime);
  if (!startDate) {
    return null;
  }
  const durationSec = toFiniteOrNull(match?.durationSec);
  if (durationSec === null || durationSec <= 0) {
    return startDate;
  }
  const endDate = new Date(startDate.getTime() + durationSec * 1000);
  return Number.isFinite(endDate.getTime()) ? endDate : startDate;
};

const formatMatchTime = (match, locale) => {
  const date = resolveMatchTime(match);
  if (!date) {
    return { date: null, text: EMPTY_VALUE, title: EMPTY_VALUE };
  }

  const title = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const differenceMs = date.getTime() - Date.now();
  const absoluteMs = Math.abs(differenceMs);
  let unit = null;
  let divisor = 1;

  if (absoluteMs < 60 * 60 * 1000) {
    unit = 'minute';
    divisor = 60 * 1000;
  } else if (absoluteMs < 24 * 60 * 60 * 1000) {
    unit = 'hour';
    divisor = 60 * 60 * 1000;
  } else if (absoluteMs < 7 * 24 * 60 * 60 * 1000) {
    unit = 'day';
    divisor = 24 * 60 * 60 * 1000;
  }

  if (unit) {
    const relativeValue = Math.round(differenceMs / divisor);
    const text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      relativeValue,
      unit
    );
    return { date, text, title };
  }

  return {
    date,
    text: new Intl.DateTimeFormat(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
    title,
  };
};

export default function OverviewRecentMatches({
  matches = [],
  copy = {},
  lang = 'zh',
  selectedMatchId = null,
  onSelectMatch,
  title = '',
}) {
  const titleId = useId();
  const visibleMatches = (Array.isArray(matches) ? matches : []).slice(0, 5);
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  const headers = copy.headers ?? {};
  const effectiveTitle =
    title ||
    (typeof copy.title === 'function'
      ? copy.title(visibleMatches.length)
      : copy.title || EMPTY_VALUE);
  const tableLabel = copy.tableAriaLabel || effectiveTitle;
  const resultHeader = headers.result || EMPTY_VALUE;
  const heroHeader = headers.hero || EMPTY_VALUE;
  const modeHeader = copy.detail?.labels?.gameMode || EMPTY_VALUE;
  const kdaHeader = headers.kda || EMPTY_VALUE;
  const economyHeader = headers.gpmXpm || EMPTY_VALUE;
  const durationHeader = headers.duration || EMPTY_VALUE;
  const timeHeader = headers.date || EMPTY_VALUE;

  return (
    <section className="panel overview-recent-matches" aria-labelledby={titleId}>
      <header className="overview-recent-matches__header">
        <h2 id={titleId} className="overview-recent-matches__title">
          {effectiveTitle}
        </h2>
      </header>

      {visibleMatches.length > 0 ? (
        <div
          className="overview-recent-matches__table-wrap"
          role="region"
          aria-label={tableLabel}
          tabIndex={0}
        >
          <table className="overview-recent-matches__table">
            <caption className="sr-only">{tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">{resultHeader}</th>
                <th scope="col">{heroHeader}</th>
                <th scope="col">{modeHeader}</th>
                <th scope="col">{kdaHeader}</th>
                <th scope="col">{economyHeader}</th>
                <th scope="col">{durationHeader}</th>
                <th scope="col">{timeHeader}</th>
                <th scope="col">
                  <span className="sr-only">{copy.openMatch || EMPTY_VALUE}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleMatches.map((match, index) => {
                const resultTone = resolveResultTone(match.result);
                const resultLabel = copy.result?.[resultTone] || EMPTY_VALUE;
                const time = formatMatchTime(match, locale);
                const openLabel =
                  typeof copy.openMatchAriaLabel === 'function'
                    ? copy.openMatchAriaLabel({
                        hero: match.hero || EMPTY_VALUE,
                        result: resultLabel,
                        date: time.title,
                      })
                    : copy.openMatch || EMPTY_VALUE;
                const isSelected = selectedMatchId === match.matchId;

                return (
                  <tr
                    key={`${match.matchId ?? 'match'}-${index}`}
                    className={`overview-recent-matches__row is-${resultTone} ${isSelected ? 'is-selected' : ''}`}
                  >
                    <td data-label={resultHeader}>
                      <span className={`overview-recent-matches__result is-${resultTone}`}>
                        {resultLabel}
                      </span>
                    </td>
                    <th
                      scope="row"
                      className="overview-recent-matches__hero"
                      data-label={heroHeader}
                    >
                      {match.heroAvatar ? (
                        <img
                          src={match.heroAvatar}
                          alt=""
                          className="overview-recent-matches__avatar"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <span className="overview-recent-matches__hero-name">
                        {match.hero || EMPTY_VALUE}
                      </span>
                    </th>
                    <td
                      className="overview-recent-matches__mode"
                      data-label={modeHeader}
                    >
                      {match.gameMode || match.queueType || EMPTY_VALUE}
                    </td>
                    <td
                      className="overview-recent-matches__kda"
                      data-label={kdaHeader}
                    >
                      <span className="is-kill">{formatInteger(match.kills)}</span>
                      <span aria-hidden="true"> / </span>
                      <span className="is-death">{formatInteger(match.deaths)}</span>
                      <span aria-hidden="true"> / </span>
                      <span className="is-assist">{formatInteger(match.assists)}</span>
                    </td>
                    <td
                      className="overview-recent-matches__economy"
                      data-label={economyHeader}
                    >
                      {formatInteger(match.goldPerMin)} / {formatInteger(match.xpPerMin)}
                    </td>
                    <td
                      className="overview-recent-matches__duration"
                      data-label={durationHeader}
                    >
                      {formatDuration(match.durationSec)}
                    </td>
                    <td
                      className="overview-recent-matches__time"
                      data-label={timeHeader}
                    >
                      {time.date ? (
                        <time dateTime={time.date.toISOString()} title={time.title}>
                          {time.text}
                        </time>
                      ) : (
                        EMPTY_VALUE
                      )}
                    </td>
                    <td data-label={copy.openMatch || EMPTY_VALUE}>
                      <button
                        type="button"
                        className="overview-recent-matches__action"
                        onClick={() => onSelectMatch?.(match)}
                        disabled={typeof onSelectMatch !== 'function'}
                        aria-label={openLabel}
                        aria-pressed={isSelected}
                      >
                        {copy.openMatch || EMPTY_VALUE}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="overview-recent-matches__empty">
          {copy.noDataText || EMPTY_VALUE}
        </p>
      )}
    </section>
  );
}

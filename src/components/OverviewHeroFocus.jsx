import { useId } from 'react';
import { formatHeroWinRate } from '../utils/metrics.js';

const EMPTY_VALUE = '-';
const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high']);

const resolveCopy = (definition, field, metrics, fallback = '') => {
  const value = definition?.[field];
  return typeof value === 'function' ? value(metrics ?? {}) : value || fallback;
};

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

const formatDecimal = (value) => {
  const number = toFiniteOrNull(value);
  return number === null ? EMPTY_VALUE : number.toFixed(2);
};

export default function OverviewHeroFocus({
  heroes = [],
  insight = null,
  coachCopy = {},
  tableCopy = {},
  onViewAll,
  viewAllLabel = '',
}) {
  const titleId = useId();
  const visibleHeroes = (Array.isArray(heroes) ? heroes : []).slice(0, 5);
  const metrics = insight?.metrics ?? {};
  const definition = coachCopy.insights?.[insight?.id] ?? {};
  const fallbackTitle = tableCopy.title || coachCopy.title || EMPTY_VALUE;
  const title = resolveCopy(definition, 'title', metrics, fallbackTitle);
  const body = resolveCopy(definition, 'body', metrics);
  const action = resolveCopy(definition, 'action', metrics);
  const confidenceKey = CONFIDENCE_LEVELS.has(insight?.confidence)
    ? insight.confidence
    : null;
  const confidenceLabel = confidenceKey
    ? coachCopy.confidence?.[confidenceKey] ?? ''
    : '';
  const headers = tableCopy.headers ?? {};
  const gpmXpmHeader = [headers.avgGpm, headers.avgXpm]
    .filter(Boolean)
    .join(' / ');
  const effectiveViewAllLabel = viewAllLabel || tableCopy.title || fallbackTitle;
  const tableLabel = tableCopy.tableAriaLabel || tableCopy.title || title;

  return (
    <section className="panel overview-hero-focus" aria-labelledby={titleId}>
      <header className="overview-hero-focus__header">
        <div className="overview-hero-focus__heading">
          <div className="overview-hero-focus__title-row">
            <h2 id={titleId}>{title}</h2>
            {confidenceLabel ? (
              <span className={`overview-hero-focus__confidence is-${confidenceKey}`}>
                {confidenceLabel}
              </span>
            ) : null}
          </div>
          {body ? <p className="overview-hero-focus__body">{body}</p> : null}
          {action ? <p className="overview-hero-focus__action">{action}</p> : null}
        </div>
      </header>

      {visibleHeroes.length > 0 ? (
        <div
          className="overview-hero-focus__table-wrap"
          role="region"
          aria-label={tableLabel}
          tabIndex={0}
        >
          <table className="overview-hero-focus__table">
            <caption className="sr-only">{tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{headers.hero || EMPTY_VALUE}</th>
                <th scope="col">{headers.matches || EMPTY_VALUE}</th>
                <th scope="col">{headers.winRate || EMPTY_VALUE}</th>
                <th scope="col">{headers.avgKda || EMPTY_VALUE}</th>
                <th scope="col">{gpmXpmHeader || EMPTY_VALUE}</th>
              </tr>
            </thead>
            <tbody>
              {visibleHeroes.map((hero, index) => (
                <tr key={hero.heroId ?? hero.hero ?? index}>
                  <td className="overview-hero-focus__rank" data-label="#">
                    {index + 1}
                  </td>
                  <th
                    scope="row"
                    className="overview-hero-focus__hero"
                    data-label={headers.hero || EMPTY_VALUE}
                  >
                    {hero.heroAvatar ? (
                      <img
                        src={hero.heroAvatar}
                        alt=""
                        className="overview-hero-focus__avatar"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                    <span className="overview-hero-focus__hero-name">
                      {hero.hero || EMPTY_VALUE}
                    </span>
                  </th>
                  <td
                    className="overview-hero-focus__metric"
                    data-label={headers.matches || EMPTY_VALUE}
                  >
                    {formatInteger(hero.matches)}
                  </td>
                  <td
                    className="overview-hero-focus__metric is-win-rate"
                    data-label={headers.winRate || EMPTY_VALUE}
                  >
                    {formatHeroWinRate(hero, EMPTY_VALUE)}
                  </td>
                  <td
                    className="overview-hero-focus__metric is-kda"
                    data-label={headers.avgKda || EMPTY_VALUE}
                  >
                    {formatDecimal(hero.avgKda)}
                  </td>
                  <td
                    className="overview-hero-focus__metric is-economy"
                    data-label={gpmXpmHeader || EMPTY_VALUE}
                  >
                    {formatInteger(hero.avgGpm)} / {formatInteger(hero.avgXpm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="overview-hero-focus__empty">
          {tableCopy.empty || coachCopy.noData || EMPTY_VALUE}
        </p>
      )}

      <footer className="overview-hero-focus__footer">
        <button
          type="button"
          className="overview-hero-focus__view-all"
          onClick={onViewAll}
          disabled={typeof onViewAll !== 'function'}
        >
          {effectiveViewAllLabel}
        </button>
      </footer>
    </section>
  );
}

import { toValidUnixDate } from '../utils/date.js';

function resolveCopy(definition, field, metrics, fallback = '') {
  const value = definition?.[field];
  return typeof value === 'function' ? value(metrics) : value || fallback;
}

const formatEvidenceStat = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : '—';
};

const formatEvidenceKda = (match) =>
  [match?.kills, match?.deaths, match?.assists]
    .map(formatEvidenceStat)
    .join('/');

const resolveEvidenceDate = (startTime, lang) => {
  const date = toValidUnixDate(startTime);
  if (!date) {
    return null;
  }

  return {
    dateTime: date.toISOString(),
    text: new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
    }).format(date),
  };
};

const resolveResultTone = (result) =>
  result === 'win' || result === 'loss' ? result : 'unknown';

export default function CoachPanel({
  insights = [],
  days,
  copy,
  lang = 'zh',
  matchesById = new Map(),
  onSelectMatch,
}) {
  return (
    <section className="panel coach-panel" aria-labelledby="coach-panel-title">
      <div className="panel-header">
        <h2 id="coach-panel-title">{copy.title}</h2>
        <span className="panel-tag">{copy.tag(days)}</span>
      </div>

      {insights.length > 0 ? (
        <div className="coach-grid">
          {insights.map((insight) => {
            const definition = copy.insights?.[insight.id] ?? {};
            const title = resolveCopy(definition, 'title', insight.metrics, insight.id);
            const body = resolveCopy(definition, 'body', insight.metrics);
            const action = resolveCopy(definition, 'action', insight.metrics);
            return (
              <article key={insight.id} className={`coach-card is-${insight.tone}`}>
                <div className="coach-card__heading">
                  <h3>{title}</h3>
                  <span>{copy.confidence[insight.confidence]}</span>
                </div>
                {body ? <p>{body}</p> : null}
                {action ? <p className="coach-card__action">{action}</p> : null}
                <footer className="coach-card__footer">
                  <dl className="coach-card__meta">
                    <div>
                      <dt>{copy.evidenceLabel}</dt>
                      <dd>{copy.sampleLabel(insight.sampleSize)}</dd>
                    </div>
                    <div>
                      <dt>{copy.rulesetLabel}</dt>
                      <dd>{insight.formulaVersion}</dd>
                    </div>
                  </dl>

                  {insight.evidenceMatchIds.length > 0 ? (
                    <ul
                      className="coach-evidence-list"
                      aria-label={copy.evidenceMatchesLabel}
                    >
                      {insight.evidenceMatchIds.map((matchId) => {
                        const match = matchesById.get(matchId);
                        const resultTone = resolveResultTone(match?.result);
                        const resultLabel =
                          copy.evidenceResult?.[resultTone] ??
                          copy.evidenceResult?.unknown ??
                          '—';
                        const hero =
                          match?.hero || copy.evidenceUnknownHero || '—';
                        const kda = formatEvidenceKda(match);
                        const date = resolveEvidenceDate(match?.startTime, lang);
                        const accessibleLabel = match
                          ? copy.evidenceMatchAriaLabel?.({
                              hero,
                              result: resultLabel,
                              kda,
                              date: date?.text || copy.evidenceDateUnknown,
                            }) || `${hero} ${resultLabel} ${kda}`
                          : copy.evidenceUnavailable;

                        return (
                          <li key={matchId}>
                            <button
                              type="button"
                              className={`coach-evidence-button is-${resultTone} ${match?.heroAvatar ? 'has-avatar' : 'has-no-avatar'}`}
                              aria-label={accessibleLabel}
                              title={accessibleLabel}
                              onClick={() => match && onSelectMatch?.(match)}
                              disabled={!match}
                            >
                              {match?.heroAvatar ? (
                                <img
                                  src={match.heroAvatar}
                                  alt=""
                                  className="coach-evidence-button__avatar"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : null}
                              <span className="coach-evidence-button__copy">
                                <span className="coach-evidence-button__topline">
                                  <span className="coach-evidence-button__hero">
                                    {hero}
                                  </span>
                                  {match ? (
                                    <span
                                      className={`coach-evidence-button__result is-${resultTone}`}
                                    >
                                      {resultLabel}
                                    </span>
                                  ) : null}
                                </span>
                                {match ? (
                                  <span className="coach-evidence-button__detail">
                                    <span>{copy.evidenceKdaLabel}</span>
                                    <strong>{kda}</strong>
                                    {date ? (
                                      <span className="coach-evidence-button__date">
                                        <span aria-hidden="true">·</span>
                                        <time dateTime={date.dateTime}>{date.text}</time>
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="coach-evidence-button__detail">
                                    {copy.evidenceUnavailable}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="coach-evidence-empty">—</p>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-text">{copy.noData}</p>
      )}
    </section>
  );
}

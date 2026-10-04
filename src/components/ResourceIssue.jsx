import { useEffect, useState } from 'react';

export default function ResourceIssue({ issue, loading, onRetry, copy }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const seconds = Math.max(0, Math.ceil(Number(issue.retryAfter) || 0));
    setRemaining(seconds);
    if (!seconds) return undefined;
    const deadline = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (!next) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [issue]);

  return <li>
    <span>{issue.message || issue.code}</span>
    {onRetry && issue.retryable !== false ? <button
      type="button"
      disabled={loading || remaining > 0}
      onClick={onRetry}
    >{loading ? copy.retrying : remaining > 0 ? copy.retryAfter(remaining) : copy.retry}</button> : null}
  </li>;
}

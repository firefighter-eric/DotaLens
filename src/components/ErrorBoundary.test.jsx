// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary.jsx';
import { getCopy } from '../i18n/copy.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.__DOTALENS_REPORT_ERROR__; });

it('keeps shell controls usable and retries only the failed panel without reporting private error text', async () => {
  let shouldThrow = true;
  const reporter = vi.fn();
  window.__DOTALENS_REPORT_ERROR__ = reporter;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Panel() { if (shouldThrow) throw new TypeError('Private account 42 secret'); return <p>Recovered panel</p>; }
  const copy = getCopy('en').resourceStatus.renderError;
  render(<><button>Navigation</button><ErrorBoundary copy={copy} onRetry={() => { shouldThrow = false; }}><Panel /></ErrorBoundary></>);
  expect(screen.getByRole('button', { name: 'Navigation' }).disabled).toBe(false);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(JSON.stringify(reporter.mock.calls)).not.toContain('Private');
  expect(reporter.mock.calls[0][0]).toMatchObject({ event: 'render_failure', errorType: 'TypeError' });
  await userEvent.click(screen.getByRole('button', { name: copy.action }));
  expect(screen.getByText('Recovered panel')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ResourceIssue from './ResourceIssue.jsx';
import { getCopy } from '../i18n/copy.js';

afterEach(() => { cleanup(); vi.useRealTimers(); });
it('enforces a fresh Retry-After on each failure and disables retries while loading', () => {
  vi.useFakeTimers();
  const retry = vi.fn();
  const copy = getCopy('en').resourceStatus;
  const issue = { message: 'Rate limited', retryAfter: 2, retryable: true };
  const view = render(<ResourceIssue issue={issue} copy={copy} onRetry={retry} />);
  expect(screen.getByRole('button').disabled).toBe(true);
  act(() => vi.advanceTimersByTime(2000));
  fireEvent.click(screen.getByRole('button'));
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(<ResourceIssue issue={issue} copy={copy} onRetry={retry} loading />);
  expect(screen.getByRole('button').disabled).toBe(true);
  view.rerender(<ResourceIssue issue={{ ...issue }} copy={copy} onRetry={retry} />);
  expect(screen.getByRole('button').disabled).toBe(true);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole('button').disabled).toBe(false);
  view.rerender(<ResourceIssue issue={{ ...issue, retryable: false }} copy={copy} onRetry={retry} />);
  expect(screen.queryByRole('button')).toBeNull();
});

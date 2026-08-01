// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeroPerformanceTable from './HeroPerformanceTable.jsx';
import TeammatesPanel from './TeammatesPanel.jsx';

afterEach(() => {
  cleanup();
});

describe('mobile sorting controls', () => {
  it('updates the controlled hero sort field and direction', async () => {
    const user = userEvent.setup();
    const onSortKeyChange = vi.fn();
    const onSortDirChange = vi.fn();

    const renderTable = (sortKey, sortDir) => (
      <HeroPerformanceTable
        heroes={[]}
        controls={{
          sortKey,
          sortDir,
          attributeFilter: 'all',
          minMatches: 2,
        }}
        onSortKeyChange={onSortKeyChange}
        onSortDirChange={onSortDirChange}
      />
    );
    const { rerender } = render(renderTable('winRate', 'desc'));

    const sortField = screen.getByLabelText('排序字段');
    const sortDirection = screen.getByLabelText('排序方向');
    await user.selectOptions(sortField, 'hero');
    rerender(renderTable('hero', 'desc'));
    await user.selectOptions(sortDirection, 'asc');
    rerender(renderTable('hero', 'asc'));

    expect(onSortKeyChange).toHaveBeenCalledWith('hero');
    expect(onSortDirChange).toHaveBeenCalledWith('asc');
    expect(sortField.value).toBe('hero');
    expect(sortDirection.value).toBe('asc');
  });

  it('reorders teammate cards by the selected field and direction', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TeammatesPanel
        teammates={[
          {
            accountId: 1,
            playerName: 'Alpha',
            matches: 10,
            wins: 4,
            losses: 6,
            winRate: 40,
            avgGpm: 500,
            avgXpm: 600,
            againstMatches: 2,
            againstWins: 1,
            againstWinRate: 50,
            lastPlayed: 100,
          },
          {
            accountId: 2,
            playerName: 'Bravo',
            matches: 5,
            wins: 4,
            losses: 1,
            winRate: 80,
            avgGpm: 450,
            avgXpm: 550,
            againstMatches: 1,
            againstWins: 1,
            againstWinRate: 100,
            lastPlayed: 200,
          },
        ]}
      />
    );
    const mobileList = container.querySelector('.teammate-mobile-list');
    const firstCardText = () =>
      within(mobileList).getAllByRole('article')[0].textContent;

    expect(firstCardText()).toContain('Alpha');

    await user.selectOptions(screen.getByLabelText('排序字段'), 'winRate');
    expect(screen.getByLabelText('排序字段').value).toBe('winRate');
    expect(firstCardText()).toContain('Bravo');

    await user.selectOptions(screen.getByLabelText('排序方向'), 'asc');
    expect(screen.getByLabelText('排序方向').value).toBe('asc');
    expect(firstCardText()).toContain('Alpha');
  });

  it('honors retryability and Retry-After for optional teammate data', () => {
    const { rerender } = render(
      <TeammatesPanel
        error="请求过于频繁"
        errorRetryable
        retryAfter={5}
        onRetry={vi.fn()}
      />
    );

    const delayedRetry = screen.getByRole('button', { name: '5 秒后重试' });
    expect(delayedRetry.disabled).toBe(true);

    rerender(
      <TeammatesPanel
        error="该资源不可用"
        errorRetryable={false}
        onRetry={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
  });
});

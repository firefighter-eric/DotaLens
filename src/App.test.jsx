// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMock = vi.hoisted(() => ({
  resource: {
    status: 'idle',
    data: null,
    error: null,
    queryKey: '',
    accountId: '',
    days: null,
    source: null,
    asOf: null,
    isRefreshing: false,
    stale: false,
  },
}));

vi.mock('./hooks/usePlayerAnalytics.js', () => ({
  createAnalyticsQueryKey: (accountId, days) =>
    accountId ? `${String(accountId)}:${Number(days)}` : '',
  usePlayerAnalytics: () => analyticsMock.resource,
}));

import App from './App.jsx';
import { ACCOUNT_STORAGE_KEY } from './utils/accountSession.js';

beforeEach(() => {
  const values = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key) => values.get(String(key)) ?? null,
      removeItem: (key) => values.delete(String(key)),
      setItem: (key, value) => values.set(String(key), String(value)),
    },
  });
  window.localStorage.clear();
  analyticsMock.resource = {
    status: 'idle',
    data: null,
    error: null,
    queryKey: '',
    accountId: '',
    days: null,
    source: null,
    asOf: null,
    isRefreshing: false,
    stale: false,
  };
});

afterEach(() => {
  cleanup();
});

describe('App smoke flow', () => {
  it('restores the active player from local storage after a remount', () => {
    window.localStorage.setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        savedAccounts: [
          {
            rawId: '4294967295',
            accountId: '4294967295',
            nickname: 'Fixture Player',
          },
        ],
        activeAccount: {
          rawId: '4294967295',
          accountId: '4294967295',
        },
        days: 365,
      })
    );

    const firstRender = render(<App />);
    expect(
      screen.getByRole('button', { name: '打开玩家档案' }).textContent
    ).toContain('Fixture Player');

    firstRender.unmount();
    render(<App />);

    expect(
      screen.getByRole('button', { name: '打开玩家档案' }).textContent
    ).toContain('Fixture Player');
    expect(JSON.parse(window.localStorage.getItem(ACCOUNT_STORAGE_KEY))).toMatchObject({
      activeAccount: {
        rawId: '4294967295',
        accountId: '4294967295',
      },
      days: 365,
    });
  });

  it('keeps the no-account sample CTA recoverable and opens the player dialog', async () => {
    const user = userEvent.setup();
    render(<App />);

    const analyzeSample = screen.getByRole('button', {
      name: '分析玩家',
    });
    await user.click(analyzeSample);

    expect(
      screen.getByRole('dialog', { name: '玩家档案与切换' })
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: 'Steam32 玩家 ID' })
      ).toBe(document.activeElement);
    });
    expect(
      screen.getByText(
        '当前展示的是示例数据。输入 Steam32 后可查看真实比赛分析。'
      )
    ).toBeTruthy();
  });

  it('connects sub-navigation tabs to real tab panels', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '提升' }));
    const trendTab = screen.getByRole('tab', { name: '趋势' });
    await user.click(trendTab);

    expect(trendTab.getAttribute('aria-selected')).toBe('true');
    await waitFor(() => {
      expect(
        screen.getByRole('tabpanel', { name: '趋势' })
      ).toBeTruthy();
    });
  });

  it('routes a non-retryable player error to account switching', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'dotalens.accounts.v2',
      JSON.stringify({
        version: 2,
        savedAccounts: [{ rawId: '42', accountId: '42', nickname: 'Player 42' }],
        activeAccount: { rawId: '42', accountId: '42' },
        days: 365,
      })
    );
    analyticsMock.resource = {
      status: 'error',
      data: null,
      error: {
        code: 'PLAYER_NOT_FOUND',
        status: 404,
        retryable: false,
        retryAfter: null,
        message: '未找到该玩家。',
      },
      queryKey: '42:365',
      accountId: '42',
      days: 365,
      source: null,
      asOf: null,
      isRefreshing: false,
      stale: false,
    };

    render(<App />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '更换玩家' }));

    expect(screen.getByRole('dialog', { name: '玩家档案与切换' })).toBeTruthy();
  });

  it('honors Retry-After before enabling another request', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'dotalens.accounts.v2',
      JSON.stringify({
        version: 2,
        savedAccounts: [{ rawId: '42', accountId: '42', nickname: 'Player 42' }],
        activeAccount: { rawId: '42', accountId: '42' },
        days: 365,
      })
    );
    analyticsMock.resource = {
      status: 'error',
      data: null,
      error: {
        code: 'RATE_LIMITED',
        status: 429,
        retryable: true,
        retryAfter: 3,
        message: '请求过于频繁。',
      },
      queryKey: '42:365',
      accountId: '42',
      days: 365,
      source: null,
      asOf: null,
      isRefreshing: false,
      stale: false,
    };

    render(<App />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: '3 秒后重试' });
      expect(button.disabled).toBe(true);
    });
    await user.click(screen.getByRole('button', { name: '查看示例数据' }));
    expect(screen.getByRole('button', { name: '3 秒后重试' }).disabled).toBe(
      true
    );
  });
});

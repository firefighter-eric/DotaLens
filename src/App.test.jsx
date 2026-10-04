// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { getCopy } from './i18n/copy.js';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
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

describe('workspace regression flows', () => {
  it('validates, adds, switches and removes profiles while persisting the selected window', async () => {
    const user = userEvent.setup();
    analyticsMock.resource = { ...analyticsMock.resource, status: 'error', queryKey: '42:365', error: { message: 'Not found', retryable: false } };
    render(<App />);
    const open = () => user.click(screen.getByRole('button', { name: '打开玩家档案' }));
    const add = async (id) => {
      await user.clear(screen.getByRole('textbox', { name: 'Steam32 玩家 ID' }));
      await user.type(screen.getByRole('textbox', { name: 'Steam32 玩家 ID' }), id);
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '分析玩家' }));
    };
    await open();
    await add('abc');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(ACCOUNT_STORAGE_KEY)).savedAccounts).toEqual([]);
    await add('42');
    await open();
    await add('43');
    expect(JSON.parse(window.localStorage.getItem(ACCOUNT_STORAGE_KEY)).activeAccount.accountId).toBe('43');
    await open();
    await user.click(screen.getByRole('button', { name: '切换到 42' }));
    expect(JSON.parse(window.localStorage.getItem(ACCOUNT_STORAGE_KEY)).activeAccount.accountId).toBe('42');
    await open();
    await user.click(screen.getByRole('button', { name: '移除 42' }));
    await user.click(screen.getByRole('button', { name: '30 天', exact: true }));
    const stored = JSON.parse(window.localStorage.getItem(ACCOUNT_STORAGE_KEY));
    expect(stored.savedAccounts.map((account) => account.accountId)).toEqual(['43']);
    expect(stored.activeAccount.accountId).toBe('43');
    expect(stored.days).toBe(30);
  });

  it.each(['loading', 'error'])('keeps navigation and local catalogs available during a player %s', async (status) => {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify({ version: 2, savedAccounts: [{ rawId: '42', accountId: '42' }], activeAccount: { rawId: '42', accountId: '42' }, days: 365 }));
    analyticsMock.resource = { ...analyticsMock.resource, status, queryKey: '42:365', error: status === 'error' ? { message: 'Not found', retryable: false } : null };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '资料库' }));
    await user.click(screen.getByRole('tab', { name: '全物品' }));
    const panel = await screen.findByRole('tabpanel', { name: '全物品' });
    await waitFor(() => expect(within(panel).getByRole('searchbox')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.hash).toBe('#allItems');
  });

  it('preserves the selected hero attribute when the language changes and exports the filtered rows', async () => {
    const user = userEvent.setup();
    const copy = getCopy('en');
    let downloadedBlob;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((blob) => { downloadedBlob = blob; return 'blob:test'; }) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);
    await user.click(screen.getByRole('button', { name: '提升' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '属性筛选' }), 'agi');
    expect(screen.getByText('共 2 个英雄')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'English', exact: true }));
    expect(screen.getByRole('combobox', { name: 'Attribute' }).value).toBe('agi');
    expect(screen.getByText('2 heroes')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: copy.table.controls.export }));
    const csv = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(downloadedBlob); });
    expect(click).toHaveBeenCalledOnce();
    expect(csv).toContain('Phantom Assassin');
    expect(csv).not.toContain('Axe');
    expect(csv.trim().split('\n')).toHaveLength(3);
    expect(window.localStorage.getItem('dotalens.language')).toBe('en');
    click.mockRestore();
  });

  it('retains library filters across hero/item tabs and translates the active controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '资料库' }));
    await user.type(await screen.findByRole('searchbox'), 'Anti-Mage');
    await user.selectOptions(screen.getByRole('combobox', { name: '攻击类型' }), 'Melee');
    await user.click(screen.getByRole('tab', { name: '全物品' }));
    await screen.findByRole('combobox', { name: '配方显示范围' });
    await user.click(screen.getByRole('tab', { name: '全英雄' }));
    expect((await screen.findByRole('searchbox')).value).toBe('Anti-Mage');
    await user.click(screen.getByRole('button', { name: 'English', exact: true }));
    expect(screen.getByRole('combobox', { name: 'Attack Type' }).value).toBe('Melee');
    expect(screen.getByRole('heading', { name: 'Hero Library' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('1 result');
  });

  it('connects sample hero expansion to actual sample match rows', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '提升' }));
    const expand = screen.queryAllByRole('button', { name: '展开 幻影刺客 比赛明细' })[0];
    if (expand) await user.click(expand);
    const details = screen.getByRole('region', { name: '幻影刺客比赛明细' });
    expect(within(details).getAllByRole('button', { name: /比赛详情/ }).length).toBeGreaterThan(0);
    expect(within(details).queryByText('该英雄暂无可展示的比赛明细。')).toBeNull();
  });
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

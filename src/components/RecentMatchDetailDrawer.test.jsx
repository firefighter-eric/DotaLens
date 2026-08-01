// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecentMatchDetailDrawer from './RecentMatchDetailDrawer.jsx';

afterEach(() => {
  cleanup();
});

describe('RecentMatchDetailDrawer coverage states', () => {
  it('distinguishes owned-without-timing, not-owned, and partial ability data', () => {
    render(
      <RecentMatchDetailDrawer
        open
        onClose={vi.fn()}
        match={{ matchId: 123, hero: 'Axe', result: 'unknown' }}
        detail={{
          matchId: 123,
          hero: 'Axe',
          overview: { result: 'unknown' },
          core: {},
          build: {
            finalItems: [],
            purchaseTimeline: [],
            scepterOwned: true,
            scepterTimeSec: null,
            scepterTimingAvailable: false,
            shardOwned: false,
            shardTimeSec: null,
            shardTimingAvailable: false,
            skillBuild: [
              {
                id: 'ability-1',
                level: 1,
                ability: 'Ability #1',
                abilityNameAvailable: false,
              },
            ],
          },
          allPlayers: [],
          partial: true,
          accessIssues: [
            {
              code: 'ABILITY_NAMES_UNAVAILABLE',
              message: '技能名称暂不可用，当前改为显示技能数字 ID。',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('部分详情不可用')).toBeTruthy();
    expect(screen.getByText('已拥有 · 时间未知')).toBeTruthy();
    expect(screen.getByText('未拥有')).toBeTruthy();
    expect(
      screen.getByText('技能名称暂不可用，当前改为显示技能数字 ID。')
    ).toBeTruthy();
    expect(
      screen.queryByText('技能名称不可用，当前显示技能数字 ID。')
    ).toBeNull();
  });

  it('distinguishes positive, verified-zero, and unavailable achievement data', () => {
    render(
      <RecentMatchDetailDrawer
        open
        onClose={vi.fn()}
        match={{ matchId: 456, hero: 'Axe', result: 'win' }}
        detail={{
          matchId: 456,
          hero: 'Axe',
          overview: {
            result: 'win',
            rampageCount: 2,
            rampageDataAvailable: true,
            godlikeCount: 0,
            godlikeDataAvailable: false,
          },
          core: {},
          build: { finalItems: [], purchaseTimeline: [], skillBuild: [] },
          allPlayers: [],
          partial: false,
          accessIssues: [],
        }}
      />
    );

    expect(screen.getByText('暴走 x2')).toBeTruthy();
    expect(screen.getByText('超神 · 数据不可用')).toBeTruthy();
  });

  it('surfaces incomplete player-profile coverage even without an access issue', () => {
    render(
      <RecentMatchDetailDrawer
        open
        onClose={vi.fn()}
        match={{ matchId: 789, hero: 'Axe', result: 'win' }}
        detail={{
          matchId: 789,
          hero: 'Axe',
          overview: { result: 'win' },
          core: {},
          build: { finalItems: [], purchaseTimeline: [], skillBuild: [] },
          allPlayers: [],
          dataCoverage: { playerProfiles: { complete: false } },
          partial: false,
          accessIssues: [],
        }}
      />
    );

    expect(
      screen.getByText('部分玩家公开资料不可用，当前显示回退名称。')
    ).toBeTruthy();
  });

  it('moves focus to a stable close control before retrying', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <RecentMatchDetailDrawer
        open
        onClose={vi.fn()}
        onRetry={onRetry}
        match={{ matchId: 999, hero: 'Axe', result: 'loss' }}
        error="加载失败"
      />
    );

    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '关闭比赛详情' })).toBe(
      document.activeElement
    );
  });

  it('does not offer futile retries and respects Retry-After', () => {
    const { rerender } = render(
      <RecentMatchDetailDrawer
        open
        onClose={vi.fn()}
        onRetry={vi.fn()}
        match={{ matchId: 1000, hero: 'Axe', result: 'unknown' }}
        error={{
          message: '比赛不存在',
          retryable: false,
          retryAfter: null,
        }}
      />
    );

    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();

    rerender(
      <RecentMatchDetailDrawer
        open
        onClose={vi.fn()}
        onRetry={vi.fn()}
        match={{ matchId: 1000, hero: 'Axe', result: 'unknown' }}
        error={{
          message: '请求过于频繁',
          retryable: true,
          retryAfter: 4,
        }}
      />
    );

    const retry = screen.getByRole('button', { name: '4 秒后重试' });
    expect(retry.disabled).toBe(true);
  });
});

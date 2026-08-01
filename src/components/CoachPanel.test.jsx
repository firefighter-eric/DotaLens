// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCopy } from '../i18n/copy.js';
import CoachPanel from './CoachPanel.jsx';

afterEach(() => {
  cleanup();
});

const insight = {
  id: 'momentum',
  tone: 'positive',
  sampleSize: 20,
  confidence: 'high',
  formulaVersion: 'coach:v1',
  metrics: {
    recentWinRate: 60,
    previousWinRate: 50,
    delta: 10,
  },
  evidenceMatchIds: [123],
};

const evidenceMatch = {
  matchId: 123,
  hero: '天怒法师',
  heroAvatar: '/assets/heroes/skywrath_mage.png',
  result: 'win',
  kills: 8,
  deaths: 7,
  assists: 13,
  startTime: 1735689600,
};

describe('CoachPanel evidence matches', () => {
  it('shows a visual match summary instead of a raw match id and opens the match', async () => {
    const user = userEvent.setup();
    const onSelectMatch = vi.fn();

    render(
      <CoachPanel
        insights={[insight]}
        days={365}
        copy={getCopy('zh').coach}
        lang="zh"
        matchesById={new Map([[evidenceMatch.matchId, evidenceMatch]])}
        onSelectMatch={onSelectMatch}
      />
    );

    expect(document.body.textContent).not.toContain('#123');
    expect(screen.getByText('天怒法师')).toBeTruthy();
    expect(screen.getByText('胜')).toBeTruthy();
    expect(screen.getByText('8/7/13')).toBeTruthy();
    expect(screen.getByText('01/01')).toBeTruthy();

    const button = screen.getByRole('button', {
      name: /查看 天怒法师，胜，K\/D\/A 8\/7\/13/,
    });
    expect(button.querySelector('img')?.alt).toBe('');
    expect(button.querySelector('time')?.getAttribute('datetime')).toBe(
      '2025-01-01T00:00:00.000Z'
    );

    await user.click(button);
    expect(onSelectMatch).toHaveBeenCalledWith(evidenceMatch);
  });

  it('uses an honest disabled fallback when a match cannot be resolved', () => {
    render(
      <CoachPanel
        insights={[insight]}
        days={365}
        copy={getCopy('zh').coach}
        matchesById={new Map()}
      />
    );

    const button = screen.getByRole('button', {
      name: '比赛信息暂不可用',
    });
    expect(button.disabled).toBe(true);
    expect(screen.getByText('比赛记录')).toBeTruthy();
    expect(screen.getByText('比赛信息暂不可用')).toBeTruthy();
  });

  it('keeps the evidence summary bilingual', () => {
    render(
      <CoachPanel
        insights={[insight]}
        days={365}
        copy={getCopy('en').coach}
        lang="en"
        matchesById={new Map([[evidenceMatch.matchId, evidenceMatch]])}
      />
    );

    expect(screen.getByText('Win')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /View the 天怒法师 evidence match: Win, K\/D\/A 8\/7\/13/,
      })
    ).toBeTruthy();
  });
});

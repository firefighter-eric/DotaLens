// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountModal from './AccountModal.jsx';

afterEach(() => {
  cleanup();
});

describe('AccountModal pending-state escape routes', () => {
  it('allows a new query, account switch, removal, and window change while loading', () => {
    render(
      <AccountModal
        open
        loading
        inputAccountId="42"
        savedAccounts={[
          {
            accountId: '42',
            rawId: '42',
            nickname: 'Player 42',
            avatar: '',
          },
        ]}
        onSubmit={vi.fn()}
        onInputChange={vi.fn()}
        onSwitchAccount={vi.fn()}
        onRemoveAccount={vi.fn()}
        onDaysChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    [
      screen.getByRole('button', { name: '分析玩家' }),
      screen.getByRole('button', { name: '切换到 Player 42' }),
      screen.getByRole('button', { name: '移除 Player 42' }),
      screen.getByRole('button', { name: '30 天' }),
      screen.getByRole('button', { name: '365 天' }),
    ].forEach((button) => {
      expect(button.disabled).toBe(false);
    });
    expect(
      screen.getByRole('dialog', { name: '玩家档案' }).querySelector('form')
        ?.getAttribute('aria-busy')
    ).toBe('true');
  });

  it('returns focus to the Steam32 field after removing the last saved player', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [accounts, setAccounts] = useState([
        {
          accountId: '42',
          rawId: '42',
          nickname: 'Player 42',
          avatar: '',
        },
      ]);
      return (
        <AccountModal
          open
          savedAccounts={accounts}
          inputAccountId=""
          onRemoveAccount={(account) =>
            setAccounts((current) =>
              current.filter((item) => item.accountId !== account.accountId)
            )
          }
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '移除 Player 42' }));

    expect(screen.getByRole('textbox', { name: 'Steam32 玩家 ID' })).toBe(
      document.activeElement
    );
  });
});

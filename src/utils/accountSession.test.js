import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_STORAGE_KEY,
  createEmptySession,
  deserializeAccountSession,
  LEGACY_ACCOUNT_STORAGE_KEY,
  loadAccountSession,
  MAX_SAVED_ACCOUNTS,
  parseSteam32,
  sanitizePersistedAccount,
  saveAccountSession,
} from './accountSession.js';

const messages = {
  steamNumeric: 'numeric',
  steamInvalid: 'invalid',
};

const createMemoryStorage = (entries = []) => {
  const values = new Map(entries);
  return {
    values,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    },
  };
};

describe('account session', () => {
  it('accepts only positive uint32 Steam IDs', () => {
    expect(parseSteam32('1', messages)).toMatchObject({ valid: true, accountId: '1' });
    expect(parseSteam32('4294967295', messages)).toMatchObject({ valid: true });
    expect(parseSteam32('0', messages)).toEqual({ valid: false, message: 'invalid' });
    expect(parseSteam32('4294967296', messages)).toEqual({ valid: false, message: 'invalid' });
    expect(parseSteam32('abc', messages)).toEqual({ valid: false, message: 'numeric' });
  });

  it('has no hard-coded personal account', () => {
    expect(createEmptySession()).toMatchObject({
      savedAccounts: [],
      queryAccountId: '',
      queryRawId: '',
    });
  });

  it('deduplicates and caps persisted accounts', () => {
    const accounts = Array.from({ length: MAX_SAVED_ACCOUNTS + 3 }, (_, index) => ({
      rawId: String(index + 1),
      accountId: String(index + 1),
      nickname: `Player ${index + 1}`,
    }));
    const session = deserializeAccountSession(
      JSON.stringify({
        savedAccounts: [...accounts, accounts[0]],
        activeAccount: accounts[0],
        days: 30,
      })
    );

    expect(session.savedAccounts).toHaveLength(MAX_SAVED_ACCOUNTS);
    expect(session.queryAccountId).toBe('1');
    expect(session.days).toBe(30);
  });

  it('rejects mismatched persisted identities and canonicalizes leading zeros', () => {
    expect(
      sanitizePersistedAccount({
        rawId: '42',
        accountId: '43',
      })
    ).toBeNull();

    const session = deserializeAccountSession(
      JSON.stringify({
        savedAccounts: [
          { rawId: '00042', accountId: '42', nickname: 'First' },
          { rawId: '42', accountId: '00042', nickname: 'Duplicate' },
        ],
        activeAccount: { rawId: '00042', accountId: '42' },
      })
    );

    expect(session.savedAccounts).toEqual([
      {
        rawId: '42',
        accountId: '42',
        nickname: 'First',
        avatar: '',
      },
    ]);
    expect(session.queryRawId).toBe('42');
    expect(session.queryAccountId).toBe('42');
  });

  it('persists a versioned schema without throwing in restricted storage', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    expect(
      saveAccountSession(
        {
          savedAccounts: [{ rawId: '42', accountId: '42', nickname: 'Player' }],
          queryRawId: '42',
          queryAccountId: '42',
          days: 365,
        },
        storage
      )
    ).toBe(true);
    expect(Array.from(values.values())[0]).toContain('"version":2');
  });

  it('loads the legacy account schema and removes it after saving v2', () => {
    const legacyPayload = JSON.stringify({
      savedAccounts: [
        {
          idType: 'steam',
          rawId: '42',
          accountId: '42',
          nickname: 'Legacy Player',
        },
      ],
      activeAccount: {
        idType: 'steam',
        rawId: '42',
        accountId: '42',
      },
    });
    const { storage, values } = createMemoryStorage([
      [LEGACY_ACCOUNT_STORAGE_KEY, legacyPayload],
    ]);

    const session = loadAccountSession(storage);
    expect(session.queryAccountId).toBe('42');
    expect(session.savedAccounts[0].nickname).toBe('Legacy Player');

    expect(saveAccountSession(session, storage)).toBe(true);
    expect(values.has(ACCOUNT_STORAGE_KEY)).toBe(true);
    expect(values.has(LEGACY_ACCOUNT_STORAGE_KEY)).toBe(false);
  });

  it('recovers from a damaged v2 payload with a valid legacy account', () => {
    const { storage } = createMemoryStorage([
      [ACCOUNT_STORAGE_KEY, '{broken-json'],
      [
        LEGACY_ACCOUNT_STORAGE_KEY,
        JSON.stringify({
          savedAccounts: [{ rawId: '42', accountId: '42', nickname: 'Player 42' }],
          activeAccount: { rawId: '42', accountId: '42' },
          days: 30,
        }),
      ],
    ]);

    expect(loadAccountSession(storage)).toMatchObject({
      queryAccountId: '42',
      queryRawId: '42',
      days: 30,
    });
  });

  it('does not resurrect legacy accounts when v2 intentionally has no players', () => {
    const { storage } = createMemoryStorage([
      [
        ACCOUNT_STORAGE_KEY,
        JSON.stringify({ version: 2, savedAccounts: [], activeAccount: null, days: 30 }),
      ],
      [
        LEGACY_ACCOUNT_STORAGE_KEY,
        JSON.stringify({
          savedAccounts: [{ rawId: '42', accountId: '42', nickname: 'Player 42' }],
          activeAccount: { rawId: '42', accountId: '42' },
        }),
      ],
    ]);

    expect(loadAccountSession(storage)).toEqual({
      ...createEmptySession(),
      days: 30,
    });
  });

  it('falls back safely when access to the global storage getter is denied', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage access denied', 'SecurityError');
      },
    });

    try {
      expect(loadAccountSession()).toEqual(createEmptySession());
      expect(
        saveAccountSession({
          savedAccounts: [],
          queryRawId: '',
          queryAccountId: '',
          days: 365,
        })
      ).toBe(false);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      } else {
        delete globalThis.localStorage;
      }
    }
  });
});

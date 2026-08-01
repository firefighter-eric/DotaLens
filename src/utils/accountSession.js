export const MAX_UINT32 = 4294967295n;
export const MAX_SAVED_ACCOUNTS = 5;
export const ACCOUNT_STORAGE_KEY = 'dotalens.accounts.v2';
export const LEGACY_ACCOUNT_STORAGE_KEY = 'dotalens.accounts.v1';
export const SUPPORTED_TIME_WINDOWS = [30, 365];
export const DEFAULT_TIME_WINDOW = 365;

export const createEmptySession = () => ({
  inputAccountId: '',
  savedAccounts: [],
  queryAccountId: '',
  queryRawId: '',
  days: DEFAULT_TIME_WINDOW,
});

export const isSameAccount = (left, right) =>
  Boolean(left && right) &&
  String(left.accountId) === String(right.accountId);

export const parseSteam32 = (value, messages) => {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      message: messages.steamNumeric,
    };
  }

  try {
    const steam32 = BigInt(normalized);
    if (steam32 <= 0n || steam32 > MAX_UINT32) {
      return {
        valid: false,
        message: messages.steamInvalid,
      };
    }
    return {
      valid: true,
      rawId: normalized,
      accountId: steam32.toString(),
    };
  } catch {
    return {
      valid: false,
      message: messages.steamInvalid,
    };
  }
};

export const sanitizePersistedAccount = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const idType = typeof value.idType === 'string' ? value.idType : 'steam';
  const rawId = typeof value.rawId === 'string' ? value.rawId.trim() : '';
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : '';
  const nickname = typeof value.nickname === 'string' ? value.nickname.trim() : '';
  const avatar = typeof value.avatar === 'string' ? value.avatar.trim() : '';

  if (idType !== 'steam' || !rawId || !accountId) {
    return null;
  }

  const parsedRawId = parseSteam32(rawId, { steamNumeric: '', steamInvalid: '' });
  const parsedAccountId = parseSteam32(accountId, { steamNumeric: '', steamInvalid: '' });
  if (
    !parsedRawId.valid ||
    !parsedAccountId.valid ||
    parsedRawId.accountId !== parsedAccountId.accountId
  ) {
    return null;
  }

  return {
    rawId: parsedRawId.accountId,
    accountId: parsedAccountId.accountId,
    nickname: nickname || parsedRawId.accountId,
    avatar,
  };
};

export const sanitizePersistedAccounts = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const accounts = [];
  for (const item of value) {
    const account = sanitizePersistedAccount(item);
    if (!account) {
      continue;
    }
    const key = account.accountId;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    accounts.push(account);
    if (accounts.length >= MAX_SAVED_ACCOUNTS) {
      break;
    }
  }
  return accounts;
};

const sanitizeDays = (value) => {
  const parsed = Number(value);
  return SUPPORTED_TIME_WINDOWS.includes(parsed) ? parsed : DEFAULT_TIME_WINDOW;
};

const decodeAccountSession = (raw) => {
  const fallback = createEmptySession();
  if (!raw) {
    return { valid: false, session: fallback };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.savedAccounts)) {
      return { valid: false, session: fallback };
    }
    const savedAccounts = sanitizePersistedAccounts(parsed?.savedAccounts);
    if (savedAccounts.length === 0) {
      return {
        valid: true,
        session: {
          ...fallback,
          days: sanitizeDays(parsed?.days),
        },
      };
    }
    const persistedActive = sanitizePersistedAccount(parsed?.activeAccount);
    const activeAccount =
      persistedActive && savedAccounts.some((account) => isSameAccount(account, persistedActive))
        ? persistedActive
        : savedAccounts[0];

    return {
      valid: true,
      session: {
        inputAccountId: activeAccount.rawId,
        savedAccounts,
        queryAccountId: activeAccount.accountId,
        queryRawId: activeAccount.rawId,
        days: sanitizeDays(parsed?.days),
      },
    };
  } catch {
    return { valid: false, session: fallback };
  }
};

export const deserializeAccountSession = (raw) => decodeAccountSession(raw).session;

const resolveStorage = (storage) => {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis?.localStorage ?? null;
  } catch {
    return null;
  }
};

export const loadAccountSession = (storage) => {
  storage = resolveStorage(storage);
  if (!storage) {
    return createEmptySession();
  }
  try {
    const current = storage.getItem(ACCOUNT_STORAGE_KEY);
    if (current !== null) {
      const decodedCurrent = decodeAccountSession(current);
      if (decodedCurrent.valid) {
        return decodedCurrent.session;
      }
    }

    const legacy = storage.getItem(LEGACY_ACCOUNT_STORAGE_KEY);
    return decodeAccountSession(legacy).session;
  } catch {
    return createEmptySession();
  }
};

export const saveAccountSession = (
  { savedAccounts, queryRawId, queryAccountId, days },
  storage
) => {
  storage = resolveStorage(storage);
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        savedAccounts: sanitizePersistedAccounts(savedAccounts),
        activeAccount:
          queryRawId && queryAccountId
            ? {
                rawId: queryRawId,
                accountId: queryAccountId,
              }
            : null,
        days: sanitizeDays(days),
      })
    );
    try {
      storage.removeItem?.(LEGACY_ACCOUNT_STORAGE_KEY);
    } catch {
      // The current schema is already saved; stale-key cleanup is best effort.
    }
    return true;
  } catch {
    return false;
  }
};

import { useEffect, useState } from 'react';
import { isSameAccount, loadAccountSession, MAX_SAVED_ACCOUNTS, parseSteam32, saveAccountSession } from '../utils/accountSession.js';

export function useAccountSession(copy) {
  const [sessionSeed] = useState(() => loadAccountSession());
  const [inputAccountId, setInputAccountId] = useState(sessionSeed.inputAccountId);
  const [savedAccounts, setSavedAccounts] = useState(sessionSeed.savedAccounts);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [queryAccountId, setQueryAccountId] = useState(sessionSeed.queryAccountId);
  const [queryRawId, setQueryRawId] = useState(sessionSeed.queryRawId);
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(sessionSeed.days);
  const [showSample, setShowSample] = useState(() => !sessionSeed.queryAccountId);
  const [inputError, setInputError] = useState('');
  useEffect(() => {
    saveAccountSession({
      savedAccounts,
      queryRawId,
      queryAccountId,
      days,
    });
  }, [savedAccounts, queryAccountId, queryRawId, days]);
  const switchToAccount = (account, forceRefresh = false) => {
    setInputAccountId(account.rawId);
    setInputError('');
    setShowSample(false);

    if (account.accountId === queryAccountId && account.rawId === queryRawId) {
      if (forceRefresh) {
        setReloadKey((value) => value + 1);
      }
      return;
    }

    setQueryAccountId(account.accountId);
    setQueryRawId(account.rawId);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedId = inputAccountId.trim();

    const parseResult = parseSteam32(normalizedId, copy.errors);
    if (!parseResult.valid) {
      setInputError(parseResult.message);
      return;
    }

    const { accountId } = parseResult;
    const nextAccount = {
      rawId: accountId,
      accountId,
      nickname: accountId,
      avatar: '',
    };

    const hasSaved = savedAccounts.some((item) => isSameAccount(item, nextAccount));
    if (!hasSaved && savedAccounts.length >= MAX_SAVED_ACCOUNTS) {
      setInputError(copy.errors.accountLimit(MAX_SAVED_ACCOUNTS));
      return;
    }

    if (!hasSaved) {
      setSavedAccounts((prev) => [nextAccount, ...prev].slice(0, MAX_SAVED_ACCOUNTS));
    }

    setInputError('');
    switchToAccount(nextAccount, true);
    setIsAccountModalOpen(false);
  };

  const handleSwitchAccount = (account) => {
    switchToAccount(account, false);
    setIsAccountModalOpen(false);
  };

  const handleRemoveSavedAccount = (account) => {
    const next = savedAccounts.filter((item) => !isSameAccount(item, account));
    if (next.length === savedAccounts.length) {
      return;
    }

    setSavedAccounts(next);
    const activeAccount = { rawId: queryRawId, accountId: queryAccountId };
    if (isSameAccount(account, activeAccount)) {
      if (next.length > 0) {
        switchToAccount(next[0], false);
      } else {
        setInputAccountId('');
        setQueryAccountId('');
        setQueryRawId('');
        setInputError('');
        setShowSample(true);
      }
    }
  };

  return { inputAccountId, setInputAccountId, savedAccounts, setSavedAccounts, isAccountModalOpen, setIsAccountModalOpen, queryAccountId, queryRawId, reloadKey, setReloadKey, days, setDays, showSample, setShowSample, inputError, setInputError, handleSubmit, handleSwitchAccount, handleRemoveSavedAccount };
}

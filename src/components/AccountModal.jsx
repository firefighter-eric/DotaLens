import { useId, useRef } from 'react';
import { useModalDialog } from './useModalDialog.js';

const fallbackCopy = {
  accountModalTitle: '玩家档案',
  closeAccountModal: '关闭玩家档案',
  accountIdLabel: 'Steam32 玩家 ID',
  accountIdPlaceholder: '例如：123456789',
  accountIdHint: 'Steam32 是公开玩家数字 ID，不需要 Steam 密码。',
  localProfileHint: '档案只保存在当前浏览器。',
  submit: '分析玩家',
  loading: '分析中…',
  savedAccounts: (count, max) => `已保存玩家 ${count}/${max}`,
  savedAccountsHint: '选择玩家可快速切换',
  savedAccountsAriaLabel: '已保存玩家',
  steamLabel: 'Steam32',
  switchSavedAccount: (name) => `切换到 ${name}`,
  removeSavedAccount: (name) => `移除 ${name}`,
  removeSavedAccountNamed: (name) => `移除 ${name}`,
  rangeAriaLabel: '分析时间窗口',
  day30: '30 天',
  day365: '365 天',
};

const getAvatarInitial = (value, fallback = '?') => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 1).toUpperCase() : fallback;
};

const callCopy = (value, fallback, ...args) => {
  const formatter = typeof value === 'function' ? value : fallback;
  return typeof formatter === 'function' ? formatter(...args) : formatter;
};

function AccountModal({
  open = false,
  copy = fallbackCopy,
  inputAccountId = '',
  onInputChange,
  onSubmit,
  loading = false,
  inputError = '',
  savedAccounts = [],
  activeAccountId = '',
  activeRawId = '',
  maxSavedAccounts = 5,
  onSwitchAccount,
  onRemoveAccount,
  days = 30,
  onDaysChange,
  onClose,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const inputHintId = useId();
  const inputErrorId = useId();
  const inputRef = useRef(null);
  const accountButtonRefs = useRef(new Map());
  const dialogRef = useModalDialog({ open, onClose, initialFocusRef: inputRef });
  const effectiveCopy = { ...fallbackCopy, ...copy };
  const handleRemoveAccount = (account, index) => {
    const nextAccount = savedAccounts[index + 1] ?? savedAccounts[index - 1] ?? null;
    onRemoveAccount?.(account);
    queueMicrotask(() => {
      const target = nextAccount
        ? accountButtonRefs.current.get(nextAccount.accountId)
        : inputRef.current;
      target?.focus();
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="account-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="query-panel account-modal">
        <div className="account-modal-header">
          <div>
            <h2 id={titleId} className="account-panel-title">
              {effectiveCopy.accountModalTitle}
            </h2>
            <p id={descriptionId} className="account-modal-description">
              {effectiveCopy.localProfileHint}
            </p>
          </div>
          <button
            type="button"
            className="account-modal-close"
            onClick={onClose}
            aria-label={effectiveCopy.closeAccountModal}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form className="query-form" onSubmit={onSubmit} noValidate aria-busy={loading}>
          <label htmlFor="account-id-input">{effectiveCopy.accountIdLabel}</label>
          <p id={inputHintId} className="field-hint">
            {effectiveCopy.accountIdHint}
          </p>
          <div className="query-controls">
            <input
              ref={inputRef}
              id="account-id-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck="false"
              placeholder={effectiveCopy.accountIdPlaceholder}
              value={inputAccountId}
              onChange={(event) => onInputChange?.(event.target.value)}
              aria-invalid={Boolean(inputError)}
              aria-describedby={`${inputHintId}${inputError ? ` ${inputErrorId}` : ''}`}
              aria-errormessage={inputError ? inputErrorId : undefined}
            />
            <button type="submit">
              {effectiveCopy.submit}
            </button>
          </div>
          {inputError ? (
            <p id={inputErrorId} className="field-error" role="alert">
              {inputError}
            </p>
          ) : null}

          <div className="saved-accounts-head">
            <span>{callCopy(effectiveCopy.savedAccounts, fallbackCopy.savedAccounts, savedAccounts.length, maxSavedAccounts)}</span>
            <span>{effectiveCopy.savedAccountsHint}</span>
          </div>
          <div className="saved-accounts" role="list" aria-label={effectiveCopy.savedAccountsAriaLabel}>
            {savedAccounts.map((account, index) => {
              const isActive = account.accountId === activeAccountId && account.rawId === activeRawId;
              const accountName = account.nickname || account.rawId;
              const accountAvatarFallback = getAvatarInitial(accountName);

              return (
                <div
                  key={`${account.rawId}:${account.accountId}`}
                  className={`saved-account-item ${isActive ? 'is-active' : ''}`}
                  role="listitem"
                >
                  <button
                    ref={(node) => {
                      if (node) {
                        accountButtonRefs.current.set(account.accountId, node);
                      } else {
                        accountButtonRefs.current.delete(account.accountId);
                      }
                    }}
                    type="button"
                    className="saved-account-btn"
                    onClick={() => onSwitchAccount?.(account)}
                    aria-pressed={isActive}
                    aria-label={callCopy(effectiveCopy.switchSavedAccount, fallbackCopy.switchSavedAccount, accountName)}
                  >
                    <span className="saved-account-main">
                      {account.avatar ? (
                        <img src={account.avatar} alt="" className="account-avatar account-avatar--saved" loading="lazy" />
                      ) : (
                        <span className="account-avatar account-avatar--saved is-fallback" aria-hidden="true">
                          {accountAvatarFallback}
                        </span>
                      )}
                      <span className="saved-account-text">
                        <span className="saved-account-name">{accountName}</span>
                        <span className="saved-account-meta">
                          {effectiveCopy.steamLabel} · {account.rawId}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-account-remove"
                    onClick={() => handleRemoveAccount(account, index)}
                    aria-label={callCopy(
                      effectiveCopy.removeSavedAccountNamed,
                      fallbackCopy.removeSavedAccountNamed,
                      accountName
                    )}
                    title={callCopy(
                      effectiveCopy.removeSavedAccountNamed,
                      fallbackCopy.removeSavedAccountNamed,
                      accountName
                    )}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="range-field">
            <span className="range-field-label">{effectiveCopy.rangeAriaLabel}</span>
            <div className="range-switch" role="group" aria-label={effectiveCopy.rangeAriaLabel}>
              <button
                type="button"
                className={days === 30 ? 'is-active' : ''}
                onClick={() => onDaysChange?.(30)}
                aria-pressed={days === 30}
              >
                {effectiveCopy.day30}
              </button>
              <button
                type="button"
                className={days === 365 ? 'is-active' : ''}
                onClick={() => onDaysChange?.(365)}
                aria-pressed={days === 365}
              >
                {effectiveCopy.day365}
              </button>
            </div>
          </div>
        </form>
      </section>
    </dialog>
  );
}

export default AccountModal;

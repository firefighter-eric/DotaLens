import { useRef } from 'react';
import { TAB_IDS, NAV_GROUPS } from '../config/workspace.js';
import { getAvatarInitial } from '../utils/display.js';

export default function WorkspaceHeader({ copy, lang, onLanguageChange, activeTab, onTabChange, playerName, playerAvatar, onOpenAccount }) {
  const tabRefs = useRef(new Map());
  const avatarInitial = getAvatarInitial(playerName);
  const tabItems = [
    { id: TAB_IDS.overview, label: copy.tabs.overview },
    { id: TAB_IDS.recentMatches, label: copy.tabs.recentMatches },
    { id: TAB_IDS.heroes, label: copy.tabs.heroes },
    { id: TAB_IDS.teammates, label: copy.tabs.teammates },
    { id: TAB_IDS.trend, label: copy.tabs.trend },
    { id: TAB_IDS.allHeroes, label: copy.tabs.allHeroes },
    { id: TAB_IDS.allItems, label: copy.tabs.allItems },
  ];
  const tabItemById = new Map(tabItems.map((item) => [item.id, item]));
  const navigationCopy = copy.navigation ?? {
    ariaLabel: copy.tabs.ariaLabel,
    home: copy.tabs.overview,
    matches: copy.tabs.recentMatches,
    improve: copy.tabs.heroes,
    library: copy.catalog.ariaLabel,
  };
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    label: navigationCopy[group.id],
  }));
  const activeNavGroup = navGroups.find((group) => group.tabs.includes(activeTab)) ?? navGroups[0];
  const activeGroupTabs = activeNavGroup.tabs.map((tabId) => tabItemById.get(tabId)).filter(Boolean);
  const visibleSubTabs = activeGroupTabs.length > 1 ? activeGroupTabs : [];
  const handleTabKeyDown = (event, index, items) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = items[nextIndex];
    onTabChange(nextTab.id);
    tabRefs.current.get(nextTab.id)?.focus();
  };
  const handleNavGroupSelect = (group) => {
    const currentTabInGroup = group.tabs.includes(activeTab);
    if (!currentTabInGroup) {
      onTabChange(group.tabs[0]);
    }
  };
  return (
      <header className="broadcast-header">
        <div className="broadcast-header__top">
          <div className="brand-lockup" aria-label={copy.app.eyebrow}>
            <img className="brand-mark" src="/favicon.svg" alt="" width="34" height="34" />
            <span className="brand-wordmark">
              DotaLens <span className="brand-accent">Analytics</span>
            </span>
          </div>

          <div className="hero-top-actions">
            <div className="language-switch" role="group" aria-label={copy.app.languageLabel}>
              <button
                type="button"
                className={lang === 'zh' ? 'is-active' : ''}
                onClick={() => onLanguageChange('zh')}
                aria-pressed={lang === 'zh'}
              >
                {copy.app.languages.zh}
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'is-active' : ''}
                onClick={() => onLanguageChange('en')}
                aria-pressed={lang === 'en'}
              >
                {copy.app.languages.en}
              </button>
            </div>
            <button
              type="button"
              className="account-summary-btn"
              onClick={onOpenAccount}
              aria-label={copy.query.openAccountModal}
            >
              <span className="account-summary-main">
                {playerAvatar ? (
                  <img referrerPolicy="no-referrer" src={playerAvatar} alt={playerName} className="account-avatar account-avatar--summary" loading="lazy" />
                ) : (
                  <span className="account-avatar account-avatar--summary is-fallback">{avatarInitial}</span>
                )}
                <span className="account-summary-name">{playerName}</span>
              </span>
            </button>
          </div>
        </div>

        <nav className="broadcast-nav" aria-label={navigationCopy.ariaLabel ?? copy.tabs.ariaLabel}>
            <div className="broadcast-nav__row">
              {navGroups.map((group) => {
                const isActive = group.id === activeNavGroup.id;
                const controlledTabId = isActive && group.tabs.includes(activeTab) ? activeTab : group.tabs[0];
                return (
                  <button
                    key={group.id}
                    id={`nav-${group.id}`}
                    type="button"
                    className={`broadcast-nav__button ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-controls={`panel-${controlledTabId}`}
                    onClick={() => handleNavGroupSelect(group)}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>

            {visibleSubTabs.length > 0 ? (
              <div className="broadcast-subnav" role="tablist" aria-label={navigationCopy.sectionAriaLabel ?? copy.tabs.ariaLabel}>
                {visibleSubTabs.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(node) => {
                      if (node) {
                        tabRefs.current.set(item.id, node);
                      } else {
                        tabRefs.current.delete(item.id);
                      }
                    }}
                    id={`tab-${item.id}`}
                    role="tab"
                    type="button"
                    className={activeTab === item.id ? 'is-active' : ''}
                    aria-selected={activeTab === item.id}
                    aria-controls={`panel-${item.id}`}
                    tabIndex={activeTab === item.id ? 0 : -1}
                    onClick={() => onTabChange(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index, visibleSubTabs)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </nav>
      </header>

  );
}

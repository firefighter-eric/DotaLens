import { useEffect, useId, useRef } from 'react';
import CatalogIcon from './CatalogIcon.jsx';

export default function CatalogControls({ kind, copy, categories, items, browser }) {
  const searchId = useId();
  const searchRef = useRef(null);
  const { view, counts, setFilters, detailOpen } = browser;
  const isHeroes = kind === 'heroes';
  const availableRoles = new Set(items.flatMap((item) => item.roles || []));

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || detailOpen || document.querySelector('dialog[open]')) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [detailOpen]);

  return <div className="library-controls" role="search" aria-label={copy.filtersLabel}>
    <div className={`library-control-row ${isHeroes ? 'library-control-row--heroes' : ''}`}>
      <div className="library-search">
        <CatalogIcon name="search" />
        <label className="sr-only" htmlFor={searchId}>{copy.searchLabel}</label>
        <input ref={searchRef} id={searchId} type="search" autoComplete="off" placeholder={isHeroes ? copy.heroSearch : copy.itemSearch} value={view.query} onChange={(event) => setFilters({ query: event.target.value })} />
        {view.query ? <button type="button" className="library-icon-button" aria-label={copy.clearSearch} onClick={() => { setFilters({ query: '' }); searchRef.current?.focus(); }}><CatalogIcon name="close" /></button> : <kbd aria-hidden="true">/</kbd>}
      </div>
      <select aria-label={copy.sortLabel} value={view.sort} onChange={(event) => setFilters({ sort: event.target.value })}>
        <option value="id">{copy.sortDefault}</option>
        <option value="name">{copy.sortName}</option>
        <option value="name-desc">{copy.sortNameDesc}</option>
      </select>
      {isHeroes ? <select aria-label={copy.heroDetails.attackType} value={view.attack} onChange={(event) => setFilters({ attack: event.target.value })}>
        <option value="all">{copy.allAttacks}</option>
        {Object.entries(copy.attackTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select> : <select aria-label={copy.recipeLabel} value={view.recipes} onChange={(event) => setFilters({ recipes: event.target.value })}>
        <option value="all">{copy.allItems}</option>
        <option value="hide">{copy.hideRecipes}</option>
        <option value="only">{copy.onlyRecipes}</option>
      </select>}
      {isHeroes ? <select aria-label={copy.heroDetails.roles} value={view.role} onChange={(event) => setFilters({ role: event.target.value })}>
        <option value="all">{copy.allRoles}</option>
        {Object.entries(copy.roles).filter(([key]) => availableRoles.has(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select> : null}
    </div>
    <div className="library-filter-row">
      <div className="library-categories" role="group" aria-label={copy.categoryLabel}>
        {categories.filter((category) => category.id !== 'unknown' || items.some((item) => item.category === 'unknown')).map((category) => <button
          key={category.id} type="button" className={`library-category tone-${category.id}`} aria-pressed={view.category === category.id} aria-label={`${category.label} ${counts[category.id] || 0}`}
          onClick={(event) => { setFilters({ category: category.id }); event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); }}
        >
          {isHeroes ? <span className="library-dot" aria-hidden="true" /> : null}<span>{category.label}</span><span className="library-category__count">{counts[category.id] || 0}</span>
        </button>)}
      </div>
    </div>
  </div>;
}

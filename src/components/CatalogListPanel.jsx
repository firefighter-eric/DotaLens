import { useEffect, useRef } from 'react';
import CatalogControls from './CatalogControls.jsx';
import CatalogArtwork from './CatalogArtwork.jsx';
import CatalogDetail from './CatalogDetail.jsx';
import CatalogIcon from './CatalogIcon.jsx';

export default function CatalogListPanel({ kind, title, tag, items, copy, emptyText, categories, browser }) {
  const cardRefs = useRef(new Map());
  const pendingFocus = useRef(null);
  const { selectedItem, visibleItems, filtered, view, hasFilters } = browser;
  const isHeroes = kind === 'heroes';
  const resultsTitle = view.category === 'all' ? (isHeroes ? copy.allHeroes : copy.allItems) : categories.find((category) => category.id === view.category)?.label;

  useEffect(() => {
    if (pendingFocus.current) {
      cardRefs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  }, [visibleItems.length]);

  return <section className={`library library--${kind}`}>
    <header className="library-header"><div><h1>{title}</h1><p>{isHeroes ? copy.heroesSubtitle : copy.itemsSubtitle}</p></div><span className="library-total">{tag}</span></header>
    {items.length ? <div className={`library-layout ${selectedItem ? '' : 'is-empty'}`}>
      <div className="library-browse">
        <CatalogControls kind={kind} copy={copy} categories={categories} items={items} browser={browser} />
        <div className="library-result-bar"><div><h2>{resultsTitle}</h2><span role="status" aria-live="polite">{copy.resultCount(filtered.length)}</span></div>{hasFilters ? <button type="button" className="library-reset" onClick={browser.reset}><CatalogIcon name="reset" />{copy.resetFilters}</button> : null}</div>
        {filtered.length ? <>
          <ul className={`library-grid ${isHeroes ? 'library-hero-grid' : ''}`}>
            {visibleItems.map((item, index) => <li key={item.key}>
              <button
                ref={(node) => { if (node) cardRefs.current.set(item.key, node); else cardRefs.current.delete(item.key); }}
                type="button" className={`library-card ${isHeroes ? 'library-hero-tile' : ''}`} aria-pressed={selectedItem?.key === item.key}
                title={isHeroes ? [item.label, item.secondaryName].filter(Boolean).join(' · ') : undefined}
                aria-label={[item.label, isHeroes && item.secondaryName !== item.label ? item.secondaryName : '', item.categoryLabel, !isHeroes ? (item.isRecipe ? copy.recipe : `#${item.id ?? '—'}`) : ''].filter(Boolean).join(' ')}
                onClick={() => { browser.select(item.key); if (window.matchMedia('(max-width: 1100px)').matches) browser.setDetailOpen(true); }}
              >
                <CatalogArtwork item={item} kind={kind} eager={index < (isHeroes ? 16 : 8)} />
                {isHeroes ? <span className="library-hero-name">{item.label}</span> : <span className="library-card-copy"><strong>{item.label}</strong>
                  <span className={`library-card-meta tone-${item.category}`}>{item.categoryLabel}<span className="library-card-id">{item.isRecipe ? copy.recipe : `#${item.id ?? '—'}`}</span></span>
                </span>}
              </button>
            </li>)}
          </ul>
          {visibleItems.length < filtered.length ? <div className="library-load-more"><button type="button" className="library-button" onClick={() => { pendingFocus.current = filtered[visibleItems.length]?.key; browser.loadMore(); }}>{copy.loadMore({ visible: visibleItems.length, total: filtered.length })}</button></div> : null}
        </> : <div className="library-empty"><CatalogIcon name="search" /><h3>{copy.noResultsTitle}</h3><p>{copy.noResultsHint}</p><button type="button" className="library-button" onClick={browser.reset}>{copy.resetFilters}</button></div>}
      </div>
      <CatalogDetail kind={kind} copy={copy} browser={browser} />
    </div> : <p className="panel-state">{emptyText}</p>}
  </section>;
}

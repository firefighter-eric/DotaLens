import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';

const fallbackCopy = {
  emptyText: 'No data.',
  allCategory: 'All',
  searchLabel: 'Search catalog',
  searchPlaceholder: 'Search by name or ID',
  clearSearch: 'Clear search',
  resultCount: (count) => `${count} results`,
  noSearchResults: 'No items match this search.',
  loadMore: ({ visible, total }) => `Show more (${visible}/${total})`,
};

const CATALOG_BATCH_SIZE = 96;

function CatalogListPanel({
  title,
  tag,
  items = [],
  copy = fallbackCopy,
  emptyText = fallbackCopy.emptyText,
  iconVariant = 'hero',
  categories = [],
  allCategoryLabel = fallbackCopy.allCategory,
  searchLabel,
  searchPlaceholder,
  clearSearchLabel,
  resultCountLabel,
  noSearchResults,
}) {
  const searchInputId = useId();
  const effectiveCategories = useMemo(() => {
    if (!categories.length) {
      return [{ id: 'all', label: allCategoryLabel }];
    }
    return categories;
  }, [allCategoryLabel, categories]);
  const [activeCategory, setActiveCategory] = useState(effectiveCategories[0]?.id ?? 'all');
  const [selectedKey, setSelectedKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(CATALOG_BATCH_SIZE);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isZh = allCategoryLabel !== 'All';
  const effectiveSearchLabel = searchLabel || copy.searchLabel || (isZh ? '搜索目录' : fallbackCopy.searchLabel);
  const effectiveSearchPlaceholder =
    searchPlaceholder || copy.searchPlaceholder || (isZh ? '按名称或 ID 搜索' : fallbackCopy.searchPlaceholder);
  const effectiveClearSearchLabel =
    clearSearchLabel || copy.clearSearch || (isZh ? '清除搜索' : fallbackCopy.clearSearch);
  const effectiveNoSearchResults =
    noSearchResults || copy.noSearchResults || (isZh ? '没有符合搜索条件的条目。' : fallbackCopy.noSearchResults);
  const effectiveResultCount = resultCountLabel || copy.resultCount;

  useEffect(() => {
    if (!effectiveCategories.some((item) => item.id === activeCategory)) {
      setActiveCategory(effectiveCategories[0]?.id ?? 'all');
    }
  }, [activeCategory, effectiveCategories]);

  const filteredItems = useMemo(() => {
    const categoryItems = activeCategory === 'all' ? items : items.filter((item) => item.category === activeCategory);
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return categoryItems;
    }
    return categoryItems.filter((item) =>
      [item.label, item.meta, item.categoryLabel, item.nameZh, item.nameEn, item.searchText]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery))
    );
  }, [activeCategory, deferredSearchQuery, items]);
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );

  useEffect(() => {
    setVisibleLimit(CATALOG_BATCH_SIZE);
  }, [activeCategory, deferredSearchQuery, items]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedKey('');
      return;
    }
    if (!filteredItems.some((item) => item.key === selectedKey)) {
      setSelectedKey(filteredItems[0].key);
    }
  }, [filteredItems, selectedKey]);

  const selectedItem = useMemo(() => {
    if (!filteredItems.length) {
      return null;
    }
    return filteredItems.find((item) => item.key === selectedKey) ?? filteredItems[0];
  }, [filteredItems, selectedKey]);
  const selectedHeroDetail = useMemo(() => {
    if (!selectedItem || iconVariant !== 'hero') {
      return null;
    }
    const rows = Array.isArray(selectedItem.detailRows) ? selectedItem.detailRows : [];
    return {
      nameZh: rows[0] ?? null,
      nameEn: rows[1] ?? null,
      attribute: rows[2] ?? null,
      primaryStats: rows.slice(3, 6),
      secondaryStats: rows.slice(6, 9),
      roles: rows[9] ?? null,
    };
  }, [iconVariant, selectedItem]);

  const countByCategory = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
    });
    return map;
  }, [items]);

  return (
    <section className="panel catalog-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span className="panel-tag">{tag}</span>
      </div>

      {items.length > 0 ? (
        <div className="catalog-layout">
          <div className="catalog-toolbar">
            <label htmlFor={searchInputId}>{effectiveSearchLabel}</label>
            <div className="catalog-search-control">
              <input
                id={searchInputId}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={effectiveSearchPlaceholder}
                autoComplete="off"
              />
              {searchQuery ? (
                <button type="button" onClick={() => setSearchQuery('')} aria-label={effectiveClearSearchLabel}>
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
            <span className="catalog-result-count" role="status" aria-live="polite">
              {typeof effectiveResultCount === 'function'
                ? effectiveResultCount(filteredItems.length)
                : isZh
                  ? `找到 ${filteredItems.length} 项`
                  : fallbackCopy.resultCount(filteredItems.length)}
            </span>
          </div>

          {selectedItem ? (
            <div
              className={`catalog-feature ${iconVariant === 'hero' ? 'is-hero-feature attr-' + selectedItem.category : ''}`}
            >
            {iconVariant === 'hero' && selectedHeroDetail ? (
              <>
                <div className="catalog-hero-head">
                  <div className="catalog-feature-media is-hero">
                    {selectedItem.icon ? (
                      <img
                        src={selectedItem.icon}
                        alt=""
                        title={selectedItem.label}
                        className="catalog-feature-image is-hero"
                      />
                    ) : (
                      <span className="catalog-feature-fallback">{selectedItem.fallback}</span>
                    )}
                  </div>
                  <div className="catalog-feature-copy">
                    <h3>{selectedItem.label}</h3>
                    <div className="catalog-hero-heading">
                      <div className="catalog-hero-names">
                        {selectedHeroDetail.nameZh ? (
                          <p className="catalog-hero-name-line">
                            <em>{selectedHeroDetail.nameZh.label}</em>
                            <span>{selectedHeroDetail.nameZh.value}</span>
                          </p>
                        ) : null}
                        {selectedHeroDetail.nameEn ? (
                          <p className="catalog-hero-name-line">
                            <em>{selectedHeroDetail.nameEn.label}</em>
                            <span>{selectedHeroDetail.nameEn.value}</span>
                          </p>
                        ) : null}
                      </div>
                      {selectedHeroDetail.attribute ? <b className="catalog-hero-attr-pill">{selectedHeroDetail.attribute.value}</b> : null}
                    </div>
                    <p>{selectedItem.description || selectedItem.meta}</p>
                    <div className="catalog-feature-meta">
                      <span>{selectedItem.meta}</span>
                      <span>{selectedItem.categoryLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="catalog-hero-detail">
                  <div className="catalog-hero-primary-grid">
                    {selectedHeroDetail.primaryStats.map((row) => (
                      <article
                        key={`${selectedItem.key}-${row.key ?? row.label}`}
                        className={`catalog-hero-stat-card ${row.tone ? `is-${row.tone}` : ''}`}
                      >
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </article>
                    ))}
                  </div>

                  <div className="catalog-hero-spec-grid">
                    {selectedHeroDetail.secondaryStats.map((row) => (
                      <p key={`${selectedItem.key}-${row.key ?? row.label}`} className="catalog-hero-spec-row">
                        <em>{row.label}</em>
                        <span>{row.value}</span>
                      </p>
                    ))}
                    {selectedHeroDetail.roles ? (
                      <p className="catalog-hero-spec-row is-wide">
                        <em>{selectedHeroDetail.roles.label}</em>
                        <span>{selectedHeroDetail.roles.value}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`catalog-feature-media ${iconVariant === 'item' ? 'is-item' : 'is-hero'}`}>
                  {selectedItem.icon ? (
                    <img
                      src={selectedItem.icon}
                      alt=""
                      title={selectedItem.label}
                      className={`catalog-feature-image ${iconVariant === 'item' ? 'is-item' : 'is-hero'}`}
                    />
                  ) : (
                    <span className="catalog-feature-fallback">{selectedItem.fallback}</span>
                  )}
                </div>
                <div className="catalog-feature-copy">
                  <h3>{selectedItem.label}</h3>
                  <p>{selectedItem.description || selectedItem.meta}</p>
                  <div className="catalog-feature-meta">
                    <span>{selectedItem.meta}</span>
                    <span>{selectedItem.categoryLabel}</span>
                  </div>
                </div>
              </>
            )}
            </div>
          ) : null}

          <div className="catalog-category-row">
            {effectiveCategories.map((category) => {
              const isAll = category.id === 'all';
              const categoryCount = isAll ? items.length : countByCategory.get(category.id) ?? 0;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`catalog-category-btn ${activeCategory === category.id ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(category.id)}
                  aria-pressed={activeCategory === category.id}
                >
                  <span>{category.label}</span>
                  <strong>{categoryCount}</strong>
                </button>
              );
            })}
          </div>

          {filteredItems.length ? (
            <>
              <div className="catalog-grid" role="list">
                {visibleItems.map((item) => (
                  <div key={item.key} className="catalog-grid-entry" role="listitem">
                    <button
                      type="button"
                      className={`catalog-grid-item ${item.key === selectedItem?.key ? 'is-active' : ''}`}
                      onClick={() => setSelectedKey(item.key)}
                      title={`${item.label} (${item.meta})`}
                      aria-pressed={item.key === selectedItem?.key}
                    >
                      <span className="catalog-grid-media">
                        {item.icon ? (
                          <img
                            src={item.icon}
                            alt=""
                            className={`catalog-grid-icon ${iconVariant === 'item' ? 'is-item' : 'is-hero'}`}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="catalog-grid-fallback" aria-hidden="true">
                            {item.fallback}
                          </span>
                        )}
                      </span>
                      <span className="catalog-grid-label">{item.label}</span>
                    </button>
                  </div>
                ))}
              </div>
              {visibleItems.length < filteredItems.length ? (
                <button
                  type="button"
                  className="catalog-load-more"
                  onClick={() =>
                    setVisibleLimit((current) =>
                      Math.min(current + CATALOG_BATCH_SIZE, filteredItems.length)
                    )
                  }
                >
                  {typeof copy.loadMore === 'function'
                    ? copy.loadMore({
                        visible: visibleItems.length,
                        total: filteredItems.length,
                      })
                    : fallbackCopy.loadMore({
                        visible: visibleItems.length,
                        total: filteredItems.length,
                      })}
                </button>
              ) : null}
            </>
          ) : (
            <p className="empty-text">{effectiveNoSearchResults}</p>
          )}
        </div>
      ) : (
        <p className="empty-text">{emptyText}</p>
      )}
    </section>
  );
}

export default CatalogListPanel;

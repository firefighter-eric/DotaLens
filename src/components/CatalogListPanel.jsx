import { useEffect, useMemo, useState } from 'react';

const fallbackCopy = {
  emptyText: 'No data.',
  allCategory: 'All',
};

function CatalogListPanel({
  title,
  tag,
  items = [],
  emptyText = fallbackCopy.emptyText,
  iconVariant = 'hero',
  categories = [],
  allCategoryLabel = fallbackCopy.allCategory,
}) {
  const effectiveCategories = useMemo(() => {
    if (!categories.length) {
      return [{ id: 'all', label: allCategoryLabel }];
    }
    return categories;
  }, [allCategoryLabel, categories]);
  const [activeCategory, setActiveCategory] = useState(effectiveCategories[0]?.id ?? 'all');
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    if (!effectiveCategories.some((item) => item.id === activeCategory)) {
      setActiveCategory(effectiveCategories[0]?.id ?? 'all');
    }
  }, [activeCategory, effectiveCategories]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') {
      return items;
    }
    return items.filter((item) => item.category === activeCategory);
  }, [activeCategory, items]);

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

      {items.length > 0 && selectedItem ? (
        <div className="catalog-layout">
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
                        alt={selectedItem.label}
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
                      alt={selectedItem.label}
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
                >
                  <span>{category.label}</span>
                  <strong>{categoryCount}</strong>
                </button>
              );
            })}
          </div>

          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`catalog-grid-item ${item.key === selectedItem.key ? 'is-active' : ''}`}
                onClick={() => setSelectedKey(item.key)}
                title={`${item.label} (${item.meta})`}
              >
                {item.icon ? (
                  <img
                    src={item.icon}
                    alt={item.label}
                    className={`catalog-grid-icon ${iconVariant === 'item' ? 'is-item' : 'is-hero'}`}
                    loading="lazy"
                  />
                ) : (
                  <span className="catalog-grid-fallback">{item.fallback}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-text">{emptyText}</p>
      )}
    </section>
  );
}

export default CatalogListPanel;

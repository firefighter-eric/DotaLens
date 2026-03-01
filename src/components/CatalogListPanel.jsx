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
          <div className="catalog-feature">
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

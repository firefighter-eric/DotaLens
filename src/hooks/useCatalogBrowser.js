import { useMemo, useState } from 'react';
import { CATALOG_BATCH_SIZE, filterCatalog } from '../utils/catalog.js';

const initialView = () => ({ query: '', category: 'all', attack: 'all', role: 'all', recipes: 'all', sort: 'id', limit: CATALOG_BATCH_SIZE, selectedKey: '' });

export function useCatalogBrowser({ kind, items, lang }) {
  const [views, setViews] = useState(() => ({ heroes: initialView(), items: initialView() }));
  const [detailOpen, setDetailOpen] = useState(false);
  const view = views[kind];
  const { filtered, counts } = useMemo(() => filterCatalog(items, view, lang), [items, view, lang]);
  const selectedIndex = Math.max(0, filtered.findIndex((item) => item.key === view.selectedKey));
  const selectedItem = filtered[selectedIndex] ?? null;

  const update = (patch) => setViews((current) => ({ ...current, [kind]: { ...current[kind], ...patch } }));
  const setFilters = (patch) => update({ ...patch, limit: CATALOG_BATCH_SIZE });
  const select = (key) => {
    const index = filtered.findIndex((item) => item.key === key);
    if (index < 0) return;
    update({ selectedKey: key, limit: Math.max(view.limit, Math.ceil((index + 1) / CATALOG_BATCH_SIZE) * CATALOG_BATCH_SIZE) });
  };
  const navigate = (offset) => {
    const item = filtered[selectedIndex + offset];
    if (item) select(item.key);
  };
  return {
    view, filtered, counts, selectedItem, selectedIndex, detailOpen,
    visibleItems: kind === 'heroes' ? filtered : filtered.slice(0, view.limit),
    hasFilters: Boolean(view.query || view.category !== 'all' || view.attack !== 'all' || view.role !== 'all' || view.recipes !== 'all'),
    setFilters, select, navigate, setDetailOpen,
    reset: () => update(initialView()),
    loadMore: () => update({ limit: view.limit + CATALOG_BATCH_SIZE }),
  };
}

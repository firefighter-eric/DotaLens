import { useMemo } from 'react';
import { useItemCatalog } from '../hooks/useItemCatalog.js';
import { useCatalogBrowser } from '../hooks/useCatalogBrowser.js';
import { buildCatalogItems, catalogCategories } from '../utils/catalog.js';
import CatalogListPanel from './CatalogListPanel.jsx';
import { heroCatalog } from '../data/heroCatalog.js';
import '../styles/catalog.css';

const EMPTY_META = new Map();

export default function CatalogTab({ kind, lang, copy, heroMetaById = EMPTY_META }) {
  const isHeroes = kind === 'heroes';
  const resource = useItemCatalog(!isHeroes);
  const categories = useMemo(() => catalogCategories(copy.catalog, kind), [copy.catalog, kind]);
  const items = useMemo(() => buildCatalogItems({ catalog: isHeroes ? heroCatalog : resource.data, kind, lang, copy: copy.catalog, heroMetaById }), [isHeroes, resource.data, kind, lang, copy.catalog, heroMetaById]);
  const browser = useCatalogBrowser({ kind, items, lang });

  if (!isHeroes && resource.status === 'error') {
    return <section className="panel resource-state" role="alert"><h1>{copy.catalog.itemsTitle}</h1><p>{copy.catalog.loadFailed}</p><button type="button" onClick={resource.retry}>{copy.resourceStatus.retry}</button></section>;
  }
  if (!isHeroes && resource.status !== 'success') {
    return <section className="library" aria-busy="true"><header className="library-header"><h1>{copy.catalog.itemsTitle}</h1></header><p className="panel-state" role="status">{copy.catalog.loading}</p><div className="library-skeleton" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div></section>;
  }
  return <CatalogListPanel kind={kind} title={isHeroes ? copy.catalog.heroesTitle : copy.catalog.itemsTitle} tag={isHeroes ? copy.catalog.heroesTag(items.length) : copy.catalog.itemsTag(items.length)} items={items} emptyText={isHeroes ? copy.catalog.heroesEmpty : copy.catalog.itemsEmpty} categories={categories} copy={copy.catalog} browser={browser} />;
}

import { useEffect, useMemo, useState } from 'react';
import CatalogListPanel from './CatalogListPanel.jsx';
import { heroCatalog } from '../data/heroCatalog.js';

const HERO_ATTRIBUTE_CATEGORY_MAP = {
  str: 'strength',
  agi: 'agility',
  int: 'intelligence',
  all: 'universal',
};

const ITEM_CATEGORY_RULES = [
  { id: 'consumable', keywords: ['tango', 'clarity', 'flask', 'dust', 'ward', 'smoke', 'tpscroll', 'mango', 'faerie'] },
  {
    id: 'attribute',
    keywords: ['gauntlets', 'slippers', 'mantle', 'circlet', 'belt', 'robe', 'branch', 'ogre_axe', 'blade_of_alacrity', 'staff_of_wizardry'],
  },
  { id: 'support', keywords: ['mekansm', 'greaves', 'pipe', 'drum', 'vladmir', 'glimmer', 'force_staff', 'lotus', 'urn', 'vessel'] },
  { id: 'magic', keywords: ['dagon', 'veil', 'kaya', 'sange_and_kaya', 'ethereal_blade', 'octarine', 'wind_waker'] },
  { id: 'armor', keywords: ['platemail', 'assault', 'shivas', 'mail', 'buckler', 'helm', 'blade_mail', 'lotus_orb'] },
  { id: 'weapon', keywords: ['sword', 'blade', 'desolator', 'daedalus', 'rapier', 'butterfly', 'basher', 'abyssal', 'manta', 'echo_sabre'] },
];

const toFiniteOrNull = (value) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizePrimaryAttr = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'universal') {
    return 'all';
  }
  return ['str', 'agi', 'int', 'all'].includes(normalized) ? normalized : '';
};

const resolveHeroCategory = (primaryAttr) =>
  HERO_ATTRIBUTE_CATEGORY_MAP[normalizePrimaryAttr(primaryAttr)] ?? 'unknown';

const resolveItemCategory = (key) => {
  const normalized = String(key ?? '').toLowerCase();
  return ITEM_CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))?.id ?? 'equipment';
};

const formatGrowthValue = (baseValue, gainValue, fallback) => {
  const base = toFiniteOrNull(baseValue);
  const gain = toFiniteOrNull(gainValue);
  if (base === null) {
    return fallback;
  }
  return gain === null ? String(base) : `${base} (+${gain.toFixed(1)})`;
};

const formatNumberValue = (value, fallback) => {
  const number = toFiniteOrNull(value);
  return number === null ? fallback : String(number);
};

const formatRolesValue = (roles, fallback) => {
  if (!Array.isArray(roles)) {
    return fallback;
  }
  const normalized = roles.filter(Boolean);
  return normalized.length > 0 ? normalized.join(' / ') : fallback;
};

const buildCategories = (copy, kind) => {
  if (kind === 'heroes') {
    return [
      { id: 'all', label: copy.catalog.categories.all },
      { id: 'strength', label: copy.catalog.categories.heroStrength },
      { id: 'agility', label: copy.catalog.categories.heroAgility },
      { id: 'intelligence', label: copy.catalog.categories.heroIntelligence },
      { id: 'universal', label: copy.catalog.categories.heroUniversal },
      { id: 'unknown', label: copy.catalog.categories.heroUnknown },
    ];
  }
  return [
    { id: 'all', label: copy.catalog.categories.all },
    { id: 'consumable', label: copy.catalog.categories.itemConsumable },
    { id: 'attribute', label: copy.catalog.categories.itemAttribute },
    { id: 'equipment', label: copy.catalog.categories.itemEquipment },
    { id: 'support', label: copy.catalog.categories.itemSupport },
    { id: 'magic', label: copy.catalog.categories.itemMagic },
    { id: 'armor', label: copy.catalog.categories.itemArmor },
    { id: 'weapon', label: copy.catalog.categories.itemWeapon },
  ];
};

const buildHeroItems = ({ copy, lang, heroMetaById, categories }) => {
  const locale = lang === 'en' ? 'en' : 'zh';
  return heroCatalog
    .slice()
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((hero) => {
      const heroMeta = heroMetaById.get(hero.id);
      const primaryAttr = normalizePrimaryAttr(hero.primaryAttr ?? hero.primary_attr ?? heroMeta?.primaryAttr);
      const label = locale === 'en' ? hero.nameEn ?? hero.nameZh ?? hero.key : hero.nameZh ?? hero.nameEn ?? hero.key;
      const category = resolveHeroCategory(primaryAttr);
      const categoryLabel = categories.find((item) => item.id === category)?.label ?? copy.catalog.categories.heroUnknown;
      const fallbackValue = copy.catalog.heroDetails.emptyValue;
      const nameZh = hero.nameZh ?? heroMeta?.nameZh ?? '';
      const nameEn = hero.nameEn ?? heroMeta?.nameEn ?? '';
      const detailRows = [
        { key: 'nameZh', label: copy.catalog.heroDetails.nameZh, value: nameZh || fallbackValue },
        { key: 'nameEn', label: copy.catalog.heroDetails.nameEn, value: nameEn || fallbackValue },
        { key: 'attribute', label: copy.catalog.heroDetails.attribute, value: categoryLabel || fallbackValue },
        {
          key: 'strength',
          tone: 'strength',
          label: copy.catalog.heroDetails.strength,
          value: formatGrowthValue(heroMeta?.baseStr ?? hero.baseStr ?? hero.base_str, heroMeta?.strGain ?? hero.strGain ?? hero.str_gain, fallbackValue),
        },
        {
          key: 'agility',
          tone: 'agility',
          label: copy.catalog.heroDetails.agility,
          value: formatGrowthValue(heroMeta?.baseAgi ?? hero.baseAgi ?? hero.base_agi, heroMeta?.agiGain ?? hero.agiGain ?? hero.agi_gain, fallbackValue),
        },
        {
          key: 'intelligence',
          tone: 'intelligence',
          label: copy.catalog.heroDetails.intelligence,
          value: formatGrowthValue(heroMeta?.baseInt ?? hero.baseInt ?? hero.base_int, heroMeta?.intGain ?? hero.intGain ?? hero.int_gain, fallbackValue),
        },
        {
          key: 'attackType',
          label: copy.catalog.heroDetails.attackType,
          value: heroMeta?.attackType ?? hero.attackType ?? hero.attack_type ?? fallbackValue,
        },
        {
          key: 'attackRange',
          label: copy.catalog.heroDetails.attackRange,
          value: formatNumberValue(heroMeta?.attackRange ?? hero.attackRange ?? hero.attack_range, fallbackValue),
        },
        {
          key: 'moveSpeed',
          label: copy.catalog.heroDetails.moveSpeed,
          value: formatNumberValue(heroMeta?.moveSpeed ?? hero.moveSpeed ?? hero.move_speed, fallbackValue),
        },
        {
          key: 'roles',
          label: copy.catalog.heroDetails.roles,
          value: formatRolesValue(heroMeta?.roles ?? hero.roles, fallbackValue),
        },
      ];
      const fallback = String(label ?? '')
        .replace(/\s+/g, '')
        .slice(0, 2)
        .toUpperCase();

      return {
        key: `hero-${hero.id}-${hero.key}`,
        label: label || `Hero #${hero.id}`,
        nameZh,
        nameEn,
        attributeLabel: categoryLabel,
        meta: `#${hero.id} · ${hero.key}`,
        description: copy.catalog.heroDescription({ attribute: categoryLabel }),
        searchText: `${label} ${nameZh} ${nameEn} ${hero.key}`,
        detailRows,
        category,
        categoryLabel,
        icon: hero.avatar ?? '',
        fallback: fallback || 'H',
      };
    });
};

const buildItemItems = ({ copy, lang, categories, catalog }) => {
  const locale = lang === 'en' ? 'en' : 'zh';
  const unknownIdLabel = copy.catalog.unknownId;
  return catalog
    .slice()
    .sort((a, b) => {
      const idA = Number.isFinite(a.id) ? a.id : Number.MAX_SAFE_INTEGER;
      const idB = Number.isFinite(b.id) ? b.id : Number.MAX_SAFE_INTEGER;
      return idA === idB ? String(a.key ?? '').localeCompare(String(b.key ?? ''), locale) : idA - idB;
    })
    .map((item) => {
      const hasLocalizedChinese = item.nameZh && item.nameZh !== item.nameEn;
      const label =
        locale === 'en'
          ? item.nameEn ?? item.nameZh ?? item.key
          : hasLocalizedChinese
            ? item.nameZh
            : item.nameEn ?? item.nameZh ?? item.key;
      const category = resolveItemCategory(item.key);
      const fallback = String(label ?? '')
        .replace(/\s+/g, '')
        .slice(0, 2)
        .toUpperCase();
      const itemId = Number.isFinite(item.id) ? `#${item.id}` : unknownIdLabel;
      const categoryLabel =
        categories.find((entry) => entry.id === category)?.label ?? copy.catalog.categories.itemEquipment;

      return {
        key: `item-${item.id ?? 'na'}-${item.key}`,
        label: label || item.key,
        meta: `${itemId} · ${item.key}`,
        description: copy.catalog.itemDescription({ id: item.id, key: item.key }),
        searchText: `${label} ${item.nameZh ?? ''} ${item.nameEn ?? ''} ${item.key}`,
        category,
        categoryLabel,
        icon: item.icon ?? '',
        fallback: fallback || 'I',
      };
    });
};

export default function CatalogTab({ kind, lang, copy, heroMetaById = new Map() }) {
  const [loadedItemCatalog, setLoadedItemCatalog] = useState(null);
  const isHeroes = kind === 'heroes';

  useEffect(() => {
    if (isHeroes || loadedItemCatalog !== null) {
      return undefined;
    }

    let active = true;
    import('../data/itemCatalog.js')
      .then((module) => {
        if (active) {
          setLoadedItemCatalog(Array.isArray(module.itemCatalog) ? module.itemCatalog : []);
        }
      })
      .catch(() => {
        if (active) {
          setLoadedItemCatalog([]);
        }
      });

    return () => {
      active = false;
    };
  }, [isHeroes, loadedItemCatalog]);

  const categories = useMemo(() => buildCategories(copy, kind), [copy, kind]);
  const items = useMemo(
    () =>
      isHeroes
        ? buildHeroItems({ copy, lang, heroMetaById, categories })
        : buildItemItems({
            copy,
            lang,
            categories,
            catalog: loadedItemCatalog ?? [],
          }),
    [categories, copy, heroMetaById, isHeroes, lang, loadedItemCatalog]
  );

  if (!isHeroes && loadedItemCatalog === null) {
    return (
      <section className="panel catalog-panel" aria-busy="true">
        <div className="panel-header">
          <h2>{copy.catalog.itemsTitle}</h2>
        </div>
        <p className="panel-state" role="status">
          {copy.catalog.loading}
        </p>
      </section>
    );
  }

  return (
    <CatalogListPanel
      title={isHeroes ? copy.catalog.heroesTitle : copy.catalog.itemsTitle}
      tag={isHeroes ? copy.catalog.heroesTag(items.length) : copy.catalog.itemsTag(items.length)}
      items={items}
      emptyText={isHeroes ? copy.catalog.heroesEmpty : copy.catalog.itemsEmpty}
      iconVariant={isHeroes ? 'hero' : 'item'}
      categories={categories}
      allCategoryLabel={copy.catalog.categories.all}
      copy={copy.catalog}
    />
  );
}

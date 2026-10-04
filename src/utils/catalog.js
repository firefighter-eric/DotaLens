const HERO_CATEGORIES = { str: 'strength', agi: 'agility', int: 'intelligence', all: 'universal', universal: 'universal' };
const ITEM_RULES = [
  ['consumable', ['tango', 'clarity', 'flask', 'dust', 'ward', 'smoke', 'tpscroll', 'mango', 'faerie']],
  ['attribute', ['gauntlets', 'slippers', 'mantle', 'circlet', 'belt', 'robe', 'branch', 'ogre_axe', 'blade_of_alacrity', 'staff_of_wizardry']],
  ['support', ['mekansm', 'greaves', 'pipe', 'drum', 'vladmir', 'glimmer', 'force_staff', 'lotus', 'urn', 'vessel']],
  ['magic', ['dagon', 'veil', 'kaya', 'sange_and_kaya', 'ethereal_blade', 'octarine', 'wind_waker']],
  ['armor', ['platemail', 'assault', 'shivas', 'mail', 'buckler', 'helm', 'blade_mail', 'lotus_orb']],
  ['weapon', ['sword', 'blade', 'desolator', 'daedalus', 'rapier', 'butterfly', 'basher', 'abyssal', 'manta', 'echo_sabre']],
];

export const CATALOG_BATCH_SIZE = 48;

export function catalogCategories(copy, kind) {
  const keys = kind === 'heroes'
    ? [['strength', 'heroStrength'], ['agility', 'heroAgility'], ['intelligence', 'heroIntelligence'], ['universal', 'heroUniversal'], ['unknown', 'heroUnknown']]
    : [['consumable', 'itemConsumable'], ['attribute', 'itemAttribute'], ['equipment', 'itemEquipment'], ['support', 'itemSupport'], ['magic', 'itemMagic'], ['armor', 'itemArmor'], ['weapon', 'itemWeapon']];
  return [{ id: 'all', label: copy.categories.all }, ...keys.map(([id, key]) => ({ id, label: copy.categories[key] }))];
}

function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function baseItem(source, lang, category, categoryLabel, kind) {
  const label = (lang === 'en' ? source.nameEn || source.nameZh : source.nameZh || source.nameEn) || source.key;
  return {
    key: `${kind}-${source.id ?? 'unknown'}-${source.key}`,
    id: numberOrNull(source.id),
    internalName: source.key,
    label,
    secondaryName: (lang === 'en' ? source.nameZh : source.nameEn) || '',
    nameZh: source.nameZh || '',
    nameEn: source.nameEn || '',
    category,
    categoryLabel,
    icon: (kind === 'heroes' ? source.avatar : source.icon) || '',
    fallback: String(label || '?').replace(/\s+/g, '').slice(0, 2).toUpperCase(),
  };
}

export function buildCatalogItems({ catalog, kind, lang, copy, heroMetaById }) {
  const categories = catalogCategories(copy, kind);
  return catalog.map((source) => {
    const hero = kind === 'heroes';
    const meta = hero ? heroMetaById?.get(source.id) : null;
    const category = hero
      ? HERO_CATEGORIES[source.primaryAttr ?? meta?.primaryAttr] || 'unknown'
      : ITEM_RULES.find(([, terms]) => terms.some((term) => String(source.key).includes(term)))?.[0] || 'equipment';
    const categoryLabel = categories.find((entry) => entry.id === category)?.label || '';
    const item = baseItem(source, lang, category, categoryLabel, kind);
    if (hero) {
      item.attackType = meta?.attackType ?? source.attackType ?? '';
      item.attackLabel = copy.attackTypes[item.attackType] || copy.heroDetails.emptyValue;
      const roles = meta?.roles ?? source.roles;
      item.roles = Array.isArray(roles) ? roles.filter((role) => typeof role === 'string' && role) : [];
      item.roleLabels = item.roles.map((role) => copy.roles[role] || role);
      item.stats = [['strength', 'baseStr', 'strGain'], ['agility', 'baseAgi', 'agiGain'], ['intelligence', 'baseInt', 'intGain']].map(([key, base, gain]) => ({
        key, label: copy.heroDetails[key],
        value: numberOrNull(meta?.[base] ?? source[base]),
        gain: numberOrNull(meta?.[gain] ?? source[gain]),
      }));
      item.attackRange = numberOrNull(meta?.attackRange ?? source.attackRange);
      item.moveSpeed = numberOrNull(meta?.moveSpeed ?? source.moveSpeed);
    } else {
      item.isRecipe = String(source.key).startsWith('recipe_');
    }
    item.searchText = [item.label, item.secondaryName, item.internalName, item.id, item.categoryLabel, item.attackLabel, ...(item.roles || []), ...(item.roleLabels || [])].join(' ').normalize('NFKC').toLocaleLowerCase();
    return item;
  });
}

/** Category counts use the other active filters, so every number describes a reachable result. */
export function filterCatalog(items, filters, lang) {
  const terms = filters.query.trim().normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matching = items.filter((item) =>
    terms.every((term) => item.searchText.includes(term)) &&
    (filters.attack === 'all' || item.attackType === filters.attack) &&
    (filters.role === 'all' || item.roles?.includes(filters.role)) &&
    (filters.recipes === 'all' || (filters.recipes === 'only' ? item.isRecipe : !item.isRecipe))
  );
  const counts = { all: matching.length };
  matching.forEach((item) => { counts[item.category] = (counts[item.category] || 0) + 1; });
  const filtered = matching.filter((item) => filters.category === 'all' || item.category === filters.category);
  const collator = new Intl.Collator(lang === 'zh' ? 'zh-CN' : 'en', { numeric: true, sensitivity: 'base' });
  filtered.sort((a, b) => filters.sort === 'id'
    ? (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER) || collator.compare(a.label, b.label)
    : collator.compare(a.label, b.label) * (filters.sort === 'name-desc' ? -1 : 1));
  return { filtered, counts };
}

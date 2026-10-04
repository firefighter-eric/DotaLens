export const loadItemCatalog = async () => {
  const module = await import('../data/itemCatalog.js');
  if (!Array.isArray(module.itemCatalog)) throw new Error('Invalid item catalog');
  return module.itemCatalog;
};

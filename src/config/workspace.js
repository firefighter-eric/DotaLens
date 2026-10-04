export const TAB_IDS = {
  overview: 'overview',
  trend: 'trend',
  heroes: 'heroes',
  teammates: 'teammates',
  recentMatches: 'recentMatches',
  allHeroes: 'allHeroes',
  allItems: 'allItems',
};
export const NAV_GROUPS = [
  { id: 'home', tabs: [TAB_IDS.overview] },
  { id: 'matches', tabs: [TAB_IDS.recentMatches] },
  { id: 'improve', tabs: [TAB_IDS.heroes, TAB_IDS.teammates, TAB_IDS.trend] },
  { id: 'library', tabs: [TAB_IDS.allHeroes, TAB_IDS.allItems] },
];


export const panelLabelId = (tabId) => {
  const group = NAV_GROUPS.find((item) => item.tabs.includes(tabId));
  return group?.tabs.length === 1 ? `nav-${group.id}` : `tab-${tabId}`;
};

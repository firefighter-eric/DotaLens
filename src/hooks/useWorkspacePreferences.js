import { useEffect, useState } from 'react';
import { TAB_IDS } from '../config/workspace.js';

const readTab = () => {
  const value = window.location.hash.slice(1);
  return Object.values(TAB_IDS).includes(value) ? value : TAB_IDS.overview;
};

export function useWorkspacePreferences() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('dotalens.language') === 'en' ? 'en' : 'zh'; }
    catch { return 'zh'; }
  });
  const [activeTab, updateTab] = useState(readTab);
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    try { localStorage.setItem('dotalens.language', lang); } catch { /* Storage may be unavailable. */ }
  }, [lang]);
  useEffect(() => {
    const readLocation = () => updateTab(readTab());
    window.addEventListener('hashchange', readLocation);
    return () => window.removeEventListener('hashchange', readLocation);
  }, []);
  const setActiveTab = (tab) => {
    if (!Object.values(TAB_IDS).includes(tab)) return;
    if (window.location.hash !== `#${tab}`) window.history.pushState(null, '', `#${tab}`);
    updateTab(tab);
  };
  return { lang, setLang, activeTab, setActiveTab };
}

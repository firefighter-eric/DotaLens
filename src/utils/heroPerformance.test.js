import { describe, expect, it } from 'vitest';
import { getHeroAttributeKey } from './heroPerformance.js';
import { createMockDashboard } from '../services/mockAnalytics.js';
import { getCopy } from '../i18n/copy.js';

describe('hero filter identity', () => {
  it('does not confuse the universal attribute with the all-attributes filter', () => {
    expect(getHeroAttributeKey({ primaryAttr: 'all', attribute: '全才' })).toBe('universal');
    expect(getHeroAttributeKey({ primaryAttr: 'all', attribute: 'Universal' })).toBe('universal');
    expect(getHeroAttributeKey({ attribute: '敏捷' })).toBe('agi');
    expect(getHeroAttributeKey({ attribute: 'Agility' })).toBe('agi');
  });
  it('uses the same hero IDs and attributes in both sample languages and match rows', () => {
    const zh = createMockDashboard(getCopy('zh'), 'zh');
    const en = createMockDashboard(getCopy('en'), 'en');
    expect(zh.heroPerformance.map((hero) => [hero.heroId, getHeroAttributeKey(hero)])).toEqual(en.heroPerformance.map((hero) => [hero.heroId, getHeroAttributeKey(hero)]));
    for (const hero of zh.heroPerformance) {
      expect(hero.heroId).toBeGreaterThan(0);
      expect(zh.windowMatches.some((match) => match.heroId === hero.heroId)).toBe(true);
    }
  });
});

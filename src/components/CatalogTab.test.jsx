// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadItemCatalog } from '../services/catalog.js';
import CatalogTab from './CatalogTab.jsx';
import { getCopy } from '../i18n/copy.js';
import { heroCatalog } from '../data/heroCatalog.js';

vi.mock('../services/catalog.js', () => ({ loadItemCatalog: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('catalog loading and recovery', () => {
  it('reports a failed catalog load and recovers in place when retried', async () => {
    const copy = getCopy('en');
    loadItemCatalog.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ id: 1, key: 'blink', nameEn: 'Blink Dagger' }]);
    render(<CatalogTab kind="items" lang="en" copy={copy} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(copy.catalog.itemsEmpty)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: copy.resourceStatus.retry }));
    expect(await screen.findByRole('button', { name: /Blink Dagger/ })).toBeTruthy();
    expect(loadItemCatalog).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('keeps an empty successful catalog distinct from a loading error', async () => {
    const copy = getCopy('zh');
    loadItemCatalog.mockResolvedValue([]);
    render(<CatalogTab kind="items" lang="zh" copy={copy} />);
    expect(await screen.findByText(copy.catalog.itemsEmpty)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('supports local hero search and category filtering without loading items', async () => {
    const user = userEvent.setup();
    const copy = getCopy('en');
    render(<CatalogTab kind="heroes" lang="en" copy={copy} />);
    await user.type(screen.getByRole('searchbox'), 'Anti-Mage');
    expect(screen.getByRole('button', { name: /Anti-Mage/ })).toBeTruthy();
    expect(loadItemCatalog).not.toHaveBeenCalled();
    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${copy.catalog.categories.heroIntelligence}`) }));
    expect(screen.queryByRole('button', { name: /Anti-Mage/ })).toBeNull();
  });

  it('combines role, attack, search, and category filters, and recovers from no results', async () => {
    const user = userEvent.setup();
    const copy = getCopy('en');
    render(<CatalogTab kind="heroes" lang="en" copy={copy} />);
    await user.type(screen.getByRole('searchbox'), 'mage');
    await user.selectOptions(screen.getByLabelText(copy.catalog.heroDetails.attackType), 'Melee');
    await user.selectOptions(screen.getByLabelText(copy.catalog.heroDetails.roles), 'Escape');
    await user.click(screen.getByRole('button', { name: /^Agility/ }));
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Anti-Mage/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Intelligence 0' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText(copy.catalog.heroDetails.roles), 'Support');
    expect(screen.getByText(copy.catalog.noResultsTitle)).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: copy.catalog.resetFilters })[0]);
    expect(screen.getByRole('searchbox').value).toBe('');
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(heroCatalog.length);
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
    await user.selectOptions(screen.getByLabelText(copy.catalog.sortLabel), 'name');
    expect(within(screen.getByRole('list')).getAllByRole('button')[0].textContent).toContain('Abaddon');
    await user.selectOptions(screen.getByLabelText(copy.catalog.sortLabel), 'name-desc');
    expect(within(screen.getByRole('list')).getAllByRole('button')[0].textContent).toContain('Zeus');
  });

  it('opens mobile details, navigates within results, and restores focus and scroll position', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const user = userEvent.setup();
    const copy = getCopy('en');
    render(<CatalogTab kind="heroes" lang="en" copy={copy} />);
    const card = screen.getByRole('button', { name: /Anti-Mage/ });
    await user.click(card);
    const dialog = screen.getByRole('dialog', { name: copy.catalog.heroDetailTitle });
    expect(within(dialog).getByRole('heading', { name: 'Anti-Mage' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: copy.catalog.previous }).disabled).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: copy.catalog.next }));
    expect(within(dialog).getByRole('heading', { name: 'Axe' })).toBeTruthy();
    const restoreScroll = vi.fn();
    vi.stubGlobal('scrollTo', restoreScroll);
    vi.stubGlobal('scrollY', 63); // Simulate native focus restoration moving the page.
    await user.click(within(dialog).getByRole('button', { name: copy.catalog.closeDetails }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(card));
    await waitFor(() => expect(restoreScroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' }));
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('still loads large item catalogs in batches and focuses the first new item', async () => {
    const user = userEvent.setup();
    loadItemCatalog.mockResolvedValue(Array.from({ length: 100 }, (_, id) => ({ id, key: `item_${id}`, nameEn: `Item ${id}` })));
    render(<CatalogTab kind="items" lang="en" copy={getCopy('en')} />);
    await user.click(await screen.findByRole('button', { name: /Show more/ }));
    const cards = within(screen.getByRole('list')).getAllByRole('button');
    expect(cards).toHaveLength(96);
    expect(document.activeElement).toBe(cards[48]);
  });

  it('keeps hero filters when browsing items and applies recipe filters independently', async () => {
    const user = userEvent.setup();
    const copy = getCopy('en');
    loadItemCatalog.mockResolvedValue([
      { id: 1, key: 'blink', nameEn: 'Blink Dagger' },
      { id: 2, key: 'recipe_blink', nameEn: 'Blink Recipe' },
    ]);
    const { rerender } = render(<CatalogTab kind="heroes" lang="en" copy={copy} />);
    await user.type(screen.getByRole('searchbox'), 'Anti-Mage');
    rerender(<CatalogTab kind="items" lang="en" copy={copy} />);
    await screen.findByRole('button', { name: /Blink Dagger Equipment/ });
    expect(screen.getByRole('searchbox').value).toBe('');
    await user.selectOptions(screen.getByLabelText(copy.catalog.recipeLabel), 'hide');
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(1);
    expect(within(screen.getByRole('list')).queryByRole('button', { name: /Blink Recipe/ })).toBeNull();
    rerender(<CatalogTab kind="heroes" lang="en" copy={copy} />);
    expect(screen.getByRole('searchbox').value).toBe('Anti-Mage');
    rerender(<CatalogTab kind="items" lang="en" copy={copy} />);
    await screen.findByRole('list');
    expect(screen.getByLabelText(copy.catalog.recipeLabel).value).toBe('hide');
  });
});

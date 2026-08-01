# DotaLens light broadcast design QA

- Date: 2026-08-01
- Reference: `docs/design/dotalens-light-broadcast-reference.png`
- Implementation captures were inspected locally at desktop and mobile sizes; ephemeral
  browser screenshots are intentionally not committed to the repository.
- State: Chinese, static sample player, 365-day window, Home tab
- Desktop viewport: 1440 x 1024 CSS pixels, CSS screenshot scale
- Mobile viewport: 390 x 844 CSS pixels, CSS screenshot scale

## Full-view comparison

The implementation matches the selected white broadcast-desk direction: true-white canvas, compact two-line application header, strong editorial title, right-aligned sample status and primary action, continuous seven-cell KPI scoreboard, two-column hero/coach analysis area, and a full-width recent-match table.

The desktop capture was compared against the reference at original resolution. The page has no horizontal overflow, no Vite error overlay, and no warning or error console messages.

## Fidelity ledger

| Surface | Reference intent | Implementation result | Status |
| --- | --- | --- | --- |
| App header and navigation | Compact two-row broadcast navigation | Brand, language/player controls, primary nav, active red underline | Pass |
| Hero/status/action | Large title with status and dominant red CTA | Same hierarchy and placement; bilingual copy preserved | Pass |
| KPI scoreboard | One continuous seven-cell strip | Seven live `StatCard` values with 30/365 switch | Pass |
| Main analysis grid | Hero focus left, actionable insights right | Responsive 1.08:1 grid with real hero assets and existing coach evidence | Pass |
| Recent matches | Full-width dense results table | Five-row table on desktop; readable two-column cards on mobile | Pass |
| Color and typography | White, charcoal, Dota red, gold, teal | Theme tokens and semantic result colors applied consistently | Pass |
| Responsive behavior | Compact mobile information hierarchy | Single-row top controls, two-column KPIs, card tables, 44 px touch targets | Pass |

## Focused mobile comparison

- At 390 px width, document overflow is 0 px.
- The header remains a compact single row above the primary navigation.
- KPI cards collapse to two columns; the odd final metric spans the full row.
- Hero and recent-match tables become bordered cards instead of overflowing tables.
- Recent-match K/D/A stays inline and the action target is 44 px high.

## Comparison history and fixes

1. Replaced the prior gray card-heavy shell with a white, edge-to-edge broadcast layout.
2. Increased the desktop content width to 1440 px so the gutters and information density match the reference.
3. Moved the page title, sample truth label, and primary action into one editorial hero row.
4. Consolidated seven headline metrics into one scoreboard and moved legacy metrics into a collapsed secondary section.
5. Added dedicated hero-focus and recent-match components to reproduce the reference hierarchy without duplicating service logic.
6. Tightened the mobile header, fixed the odd scoreboard cell, and converted both data tables to compact cards.
7. Fixed mobile recent-match hero and K/D/A cells with selector-specific flex rules; rechecked at 390 px with no overflow.

## Above-fold copy diff

No unintended extra visible heading remains above the scoreboard. The existing time-window label is retained for accessibility as screen-reader-only text. The sample-data disclosure remains explicit and the English equivalent is present.

## Intentional deviations

- Uses the repository's lens mark rather than the generated concept's fictional Dota glyph.
- Keeps the existing two-button 30/365-day switch rather than introducing a new dropdown.
- Uses available hero artwork and text-only coaching signals rather than decorative iconography with no trusted source.

## Final result

passed

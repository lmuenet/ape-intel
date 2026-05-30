# Dashboard Badge Popover — Implementation Plan

> Implements **ADR-0008**. TDD throughout. The Trending Board gains a second,
> primary entry: an in-page popover launched from the Badge anchor. The toolbar
> popup stays as a global fallback. Both render the same board `App`.

## Task 1: Make the board styles surface-neutral (refactor)

**Files:** `src/popup/popup.css`, `src/popup/popup-shell.css` (new), `src/popup/index.tsx`

- The board `App` will be rendered inside the content script too; its stylesheet
  must not carry global selectors (`body`, `:root`) or they restyle the Broker page.
- [ ] Move the `:root { color-scheme }` and `body { margin: 0 }` rules out of
  `popup.css` into a new `popup-shell.css`, imported only by the toolbar popup
  entry (`src/popup/index.tsx`). `popup.css` becomes scoped (`.ape-*` only).
- [ ] Guard: full suite + `npm run build` stay green; no behaviour change.
- [ ] Commit `refactor(popup): scope board styles, body reset to popup shell`.

## Task 2: DashboardOverlay (content surface) — TDD

**Files:** `src/content/DashboardOverlay.tsx`(+test), `src/content/dashboardOverlay.css`

- [ ] Failing tests: when `isOpen` it renders the board `App` (one section
  heading suffices to assert), a close button calls `onClose`, Escape calls
  `onClose`, and click on the backdrop (outside the panel) calls `onClose` while
  a click inside does not; when `!isOpen` it renders nothing.
- [ ] Implement a ChartOverlay-style wrapper docked bottom-right (not centered):
  backdrop + inner panel anchored bottom-right, Esc + click-outside + a × button,
  `role="dialog"`. Body = `<App />` (reused). Inject `App` via prop for test
  isolation (default = the real `App`).
- [ ] Green + typecheck. Commit `feat(content): dashboard popover overlay`.

## Task 3: Badge gains a dashboard action — TDD

**Files:** `src/content/Badge.tsx`(+test), `src/content/badge.css`

- [ ] Failing tests: the Badge exposes two controls — the main area still calls
  `onClick` (Side Panel), and a separate dashboard icon button calls a new
  `onOpenDashboard`. Valid markup (no nested buttons). Existing Badge assertions
  (ISIN, ticker, barometer) still pass.
- [ ] Implement: split the Badge into a main button + an adjacent icon button.
  The dashboard icon is always rendered (market-wide, coverage-independent).
- [ ] Green + typecheck. Commit `feat(badge): dashboard launcher icon`.

## Task 4: Wire the overlay into the content script — (glue)

**Files:** `src/content/index.tsx`

- [ ] Add `isDashboardOpen` state. `onOpenDashboard` opens the dashboard and
  closes the Side Panel + chart; opening the Side Panel or chart closes the
  dashboard (mutually exclusive anchor surfaces). Render `<DashboardOverlay>`.
- [ ] `npm run build` clean; `npm run typecheck` green.
- [ ] Commit `feat(content): launch dashboard popover from the badge`.

## Task 5: Full suite + manual verification

- [ ] `npm run typecheck && npm test` green; `npm run build` clean; confirm the
  built content CSS contains **no** bare `body {` rule.
- [ ] Interactive (Firefox): on a Broker page, the Badge shows a dashboard icon;
  clicking it opens the bottom-right popover with Trending + Favourites +
  Challenge; Esc / click-outside / × close it; opening it closes the Side Panel
  and vice versa; the toolbar popup still works.

## Done criteria
- Board reachable from the Badge (primary) and the toolbar (fallback), same `App`.
- Anchor surfaces mutually exclusive; no global CSS leaks onto Broker pages.
- All tests + typecheck green; build loadable.

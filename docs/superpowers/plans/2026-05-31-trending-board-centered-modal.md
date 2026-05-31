# Trending Board → Large Centered Modal — Implementation Plan

> Implements **ADR-0009**. The in-page Trending Board surface becomes a large
> centered modal (ChartOverlay-style), the board renders two columns when wide
> (responsive via CSS container query, `App` stays surface-agnostic), and the
> Side Panel docks higher so it clears the always-on-top Badge.

## Task 1: Two-column responsive board layout — TDD

**Files:** `src/popup/App.tsx`, `src/popup/App.test.tsx`, `src/popup/popup.css`

- [ ] Failing test: the two board sections (Trending, Favourites) live inside a
  single `.ape-popup__cols` wrapper (assert the wrapper exists and contains both
  section headings). Existing App tests stay green.
- [ ] Wrap the two `<section class="ape-popup__section">` in
  `<div class="ape-popup__cols">`; the brand `<header>` stays above it.
- [ ] CSS: `.ape-popup { container-type: inline-size }`; `.ape-popup__cols`
  default single-column; `@container (min-width: 760px) { .ape-popup__cols {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px } }`. Popup (380px)
  stays stacked; modal goes two-column. No new prop on `App`.
- [ ] Green + typecheck. Commit `feat(popup): responsive two-column board layout`.

## Task 2: Dashboard overlay → centered modal (restyle)

**Files:** `src/content/dashboardOverlay.css`

- [ ] Rewrite from docked bottom-right to ChartOverlay-style centered modal:
  `.ape-dash` = `inset:0`, dimmed backdrop, flex-centered, padding; `.ape-dash__panel`
  = centered box (`max-width: ~1000px`, `max-height: ~85vh`, `width: 100%`),
  scroll inside. Keep `.ape-dash__close` (×). No change to `DashboardOverlay.tsx`
  — Esc / click-outside / × structure and its tests stay valid.
- [ ] `DashboardOverlay.test.tsx` stays green (dismiss mechanics unchanged).
- [ ] Build clean + typecheck. Commit `feat(content): trending board opens as a centered modal`.

## Task 3: Side Panel clears the Badge

**Files:** `src/content/sidePanel.css`

- [ ] Raise `.ape-intel-panel { bottom: 92px → 116px }` so the ~80px-tall Badge
  (bottom:16px) no longer overlaps the panel's lower edge. Badge stays visible as
  the open/close toggle (ADR-0003).
- [ ] Build clean. Commit `fix(content): side panel clears the badge`.

## Task 4: Full suite + manual verification

- [ ] `npm run typecheck && npm test` green; `npm run build` clean.
- [ ] Interactive (Firefox): Badge dashboard icon opens a large centered modal
  with Trending + Favourites side by side; Esc / click-outside / × close it;
  Side Panel no longer overlaps the Badge; toolbar popup still single-column.

## Done criteria
- In-page board is a large centered modal; toolbar popup unchanged (narrow).
- Board is two-column when wide, single-column when narrow — one shared `App`,
  difference is pure CSS (container query).
- Badge no longer overlaps the Side Panel.
- All tests + typecheck green; build loadable.

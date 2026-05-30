# ADR-0008: Trending Board also opens as a Badge-anchored popover (amends ADR-0007)

Status: Accepted
Date: 2026-05-31
Amends: ADR-0007 (entry point)

## Context

ADR-0007 made the Trending Board a `browser_action` toolbar popup, chosen because
the board is market-wide and should be reachable with no Broker page open. In use
that entry point proved **too hidden**: the toolbar icon is easy to forget, and
the owner is almost always already on a Broker page (where the extension's
always-visible **Badge** sits) when they want the board.

The extension already has a precedent for an in-page overlay launched from the
Badge region: the TradingView **chart overlay** (`ChartOverlay`) is opened from
the Side Panel and dismissed by click-outside / Esc. The Trending Board's
content is the same Preact `App` we built for the popup, and it talks to the
background via `browser.runtime.sendMessage`, which works identically in a content
script — so the board is portable to an in-page surface with no logic changes.

## Decision

Add a **Badge-anchored popover** as the **primary** entry to the Trending Board,
and keep the toolbar popup as a **global fallback**.

- **Badge gains a second action.** The Badge is split into its main area (opens
  the **Side Panel**, as before) and a small separate icon button that opens the
  **Trending Board popover**. The dashboard icon is always present, independent of
  the current Asset's coverage (the board is market-wide).
- **Form factor: a docked popover**, bottom-right, rising from the anchor — not a
  centered modal. It reuses the overlay dismiss mechanics (click-outside, Esc, a
  close button) but suits the board's narrow column shape and "widget from the
  anchor" feel.
- **Mutually exclusive anchor surfaces.** Opening the Trending Board popover
  closes the Side Panel (and the chart overlay), and vice versa — only one anchor
  surface is visible at a time, avoiding a crowded bottom-right corner.
- **Shared component, two surfaces.** The popup and the popover render the same
  board `App`. To make it surface-agnostic, the shared dashboard styles must not
  carry a global `body` rule; the `body` reset stays in the toolbar-popup wrapper
  only, so injecting the board into a Broker page never restyles that page.
- **Toolbar popup stays** unchanged as the only way to reach the board with no
  Broker page open.

## Consequences

**Positive**
- The board is discoverable where the user actually is — one visible click on the
  always-present anchor.
- No loss of reach: the toolbar still covers the no-Broker-page case.
- Near-zero new logic: the board `App` is reused as-is; only a thin overlay
  wrapper, the Badge split, and CSS scoping are added.

**Negative**
- Two entry points and two surfaces to keep working (toolbar popup + in-page
  popover), though they share the same component.
- The Badge becomes a compound control (two targets) rather than a single button;
  its markup and `ADR-0003` description change accordingly.
- Shared CSS must stay scoped (no global selectors) or it leaks onto Broker pages.

## Alternatives Considered

- **Replace the toolbar popup entirely.** Rejected: loses the ability to see the
  board with no Broker page open, for little gain since keeping it is cheap.
- **Launch from inside the Side Panel** (like the chart overlay) instead of a
  dedicated Badge icon. Rejected as still too hidden (an extra click); the owner
  wanted it directly on the anchor.
- **Centered modal** like `ChartOverlay`. Rejected in favour of a docked popover
  that matches the board's narrow column and the "popup from the anchor" intent.
- **Full-height right drawer.** Rejected: collides conceptually with the Side
  Panel, which is already the right-drawer surface.

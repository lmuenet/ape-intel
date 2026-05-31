# ADR-0009: Trending Board in-page surface is a large centered modal (supersedes ADR-0008 form factor)

Status: Accepted
Date: 2026-05-31
Supersedes: ADR-0008 (form factor only — the dual-entry decision stands)

## Context

ADR-0008, accepted the same day, made the Badge-anchored Trending Board a
**docked bottom-right popover** and explicitly rejected a centered modal, to suit
"the board's narrow column shape and 'widget from the anchor' feel". In first use
two problems surfaced:

1. **Too small to be the discovery view it is meant to be.** The board is the
   cross-Asset "what's hot right now" surface; a narrow docked column shows few
   rows and makes the Trending list and the Favourites companion compete for the
   same vertical space (one scrolls the other out of view).

2. **It crowded the bottom-right corner.** The **Badge** carries the highest
   `z-index` and sits bottom-right; the docked popover (and the **Side Panel**)
   rise from just above it, so the Badge overlapped the bottom edge of whatever
   surface was open. The corner had three things fighting for the same pixels.

The extension already has a proven "big" in-page surface: the TradingView
**chart overlay** (`ChartOverlay`) — a centered modal with a dimmed backdrop,
dismissed by Esc / click-outside / a × button. Reusing that form factor for the
board removes the corner crowding entirely (a centered modal covers the Badge
instead of being overlapped by it) and gives the board room to breathe.

## Decision

The **in-page** Trending Board surface becomes a **large centered modal**, built
on the existing `ChartOverlay` form factor.

- **Centered modal, dimmed backdrop**, not docked bottom-right. Dismiss mechanics
  unchanged from ADR-0008: Esc, click-outside (backdrop), and a × button.
- **Two-column board layout when wide.** Inside the modal the board renders the
  Trending list and the Favourites companion **side by side** instead of stacked,
  so both are visible without scrolling one past the other.
- **One shared, surface-agnostic `App`.** The board does not know which surface it
  is in. The single-vs-two-column choice is driven purely by available width via a
  **CSS container query** (`container-type: inline-size` on the board root; two
  columns above a width threshold). This keeps ADR-0008's "shared component, two
  surfaces" principle intact and needs no new prop.
- **Toolbar popup is unchanged.** A `browser_action` popup cannot grow wide, so
  below the container-query threshold the board stays single-column — exactly the
  stacked popup we already ship. No popup regression.
- **Side Panel docks higher.** Independent of the modal change, the Side Panel's
  bottom offset is raised so it clears the always-on-top Badge; the Badge stays
  visible as its open/close toggle (consistent with ADR-0003). This resolves the
  remaining Badge↔Side-Panel overlap that the modal change does not touch.

ADR-0008's substance — the Badge gains a second action, two entry points (Badge
primary + toolbar fallback), mutually exclusive anchor surfaces, no global CSS
leaks — all stand. Only the **form factor** ("docked popover, not a centered
modal") is reversed.

## Consequences

**Positive**
- The discovery view gets the space it needs; Trending and Favourites are visible
  together.
- The bottom-right corner stops fighting: a centered modal covers the Badge rather
  than being overlapped by it, and the Side Panel offset clears the Badge.
- Still one shared `App`; the surface difference is pure CSS (container query), so
  no logic forks between popup and modal.

**Negative**
- Reverses a one-day-old accepted decision — the "widget from the anchor" feel of
  ADR-0008 is gone in favour of a heavier modal. We judged the discovery-view
  ergonomics worth more than that lighter feel.
- A two-column responsive layout is new board CSS to maintain, and the container
  query must keep the popup (narrow) safely single-column.
- A dimmed backdrop obscures more of the Broker page than the docked popover did
  (acceptable: the board is a deliberate, dismissable context switch, like the
  chart).

## Alternatives Considered

- **Keep the docked popover, just make it bigger.** Rejected: a larger docked
  panel still crowds the Badge corner and still can't show Trending + Favourites
  side by side comfortably.
- **Near-fullscreen takeover.** Rejected: more disruptive than needed; the
  chart-style centered modal already gives ample room and matches an existing,
  familiar pattern.
- **Layout variant via an explicit prop** (`layout="wide" | "compact"`) instead of
  a container query. Rejected: reintroduces surface-awareness into the shared
  `App`, against ADR-0008's "surface-agnostic component" principle.
- **Hide the Badge while any surface is open** (instead of raising the Side Panel
  offset). Rejected: the Badge is the Side Panel's open/close toggle (ADR-0003);
  a small offset keeps that affordance while removing the overlap.

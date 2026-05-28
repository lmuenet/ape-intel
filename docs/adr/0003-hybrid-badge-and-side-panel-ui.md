# ADR-0003: Hybrid always-visible badge + on-demand side panel

Status: Accepted
Date: 2026-05-28

## Context

The extension lives on top of Scalable Capital's React SPA. We had to pick
one of four placements: floating side-panel, inline DOM injection,
browser-action popup, or hybrid badge + panel. The use case is "form a
quick gut feeling while browsing securities", which biases toward
always-visible information; the technical reality is that injecting into
Scalable's component tree is fragile and inline anchors break whenever
Scalable rebuilds its layout.

## Decision

**Hybrid.** Two coordinated UI elements, both attached to `document.body`,
not into Scalable's React tree:

- A small **Badge** anchored bottom-right of the viewport. Always visible
  on a Scalable security page. Shows the three headline values:
  Barometer, Buzz, Trend.
- A **Side Panel** that opens on Badge click. Holds News, Earnings Date,
  per-Source breakdown, AI Analysis trigger. Width ~400px.

**Auto-injection** on any URL matching the security page pattern. No
opt-in per asset.

**State persistence across SPA navigation.** When the user switches from
Asset A to Asset B without a full page reload, the panel stays open and
**re-renders with B's data** rather than collapsing back to badge-only.
Detection is via `MutationObserver` + URL change listener watching the
`isin` query parameter.

## Consequences

**Positive**

- Headline numbers visible without any click — matches the "browsing
  feeling" use case.
- Both elements live on `document.body`, so Scalable layout changes
  cannot break our DOM anchor.
- One ISIN-change handler drives both UI elements; no second event
  pipeline.

**Negative**

- Always-visible badge can collide with Scalable's own tooltips, cookie
  banners or modals. We accept this and may need a manual hide toggle
  later.
- Auto-injection on Uncovered assets (ETFs, no US listing) means the
  badge will frequently show "no data" states. Acceptable cost for not
  forcing the user to opt in per asset.
- We are overlaying persistent UI on a third-party site. Scalable's ToS
  do not (currently) forbid this, but it is a low-grade ongoing risk.

## Alternatives Considered

- **Side panel only.** One UI element to maintain, but requires a click
  before any value is delivered.
- **Inline DOM injection** under the chart. Most "native" looking,
  guaranteed to break on every Scalable redesign.
- **Browser-action popup only.** Cleanest technically, but invisible to
  users who don't know the extension exists.

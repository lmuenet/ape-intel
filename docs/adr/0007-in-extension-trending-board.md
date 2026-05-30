# ADR-0007: In-extension Trending Board, toolbar-opened, AI via export/re-ingest

Status: Accepted
Date: 2026-05-30
Relaxes: PRD §2 non-goal "trending tickers discovery view"
Relates to: PRD §11 (external "Morning Call" routine), ADR-0005 (export/re-ingest)

## Context

A cross-Asset "what's hot right now" view was an explicit v1 non-goal
(CONTEXT.md, PRD §2), but PRD §11 always intended a market-wide scan to exist —
as an *external* Claude Code cron routine ("Morning Call"), with the extension as
data collector/frontend and the routine as analyst. The owner now wants a
**Trending Board inside the extension** that the AI can help curate.

Three facts shaped the decision:

1. **The list already exists, for free.** `apewisdom-service` fetches the entire
   rank-sorted Apewisdom snapshot (5 pages of "all-stocks") and caches it in
   `storage.local` with a 15-min TTL; the per-Asset `lookup(ticker)` just reads
   one entry out of it. The board is a re-render of cached data — no new fetch,
   no new API surface. So the AI does **not** create the list; Apewisdom does.

2. **The extension has no global UI entry point.** Today everything is
   content-script-injected onto a Broker security page (Badge + Side Panel hang
   off that page's `document.body`). A global, broker-independent view needs a
   new home.

3. **A trending row cannot reliably deep-link into a Broker.** Apewisdom yields a
   US-ticker, not an ISIN; OpenFIGI maps ISIN→ticker (one direction only), and
   Broker URLs are user-specific (Smartbroker+ embeds the user's `portfolioId`).
   But all background services are already **ticker-keyed**, so a row *can* show
   full intel inline with zero new plumbing.

## Decision

Build the **Trending Board** as an in-extension view, honouring "no backend":

- **Entry point:** a Firefox toolbar `browser_action` popup. Global, reachable
  even with no Broker page open. (New `action`/`browser_action` in the manifest;
  the extension's only non-broker-page surface.)
- **Base list:** read the already-cached Apewisdom snapshot, sort by rank,
  render. No new network calls.
- **Row interaction:** a row expands to show that Asset's full intel inline
  (Barometer / Buzz / Trend / News) via the existing ticker-keyed services, plus
  external links (StockTwits / TradingView) via the existing ExternalLinksBar
  pattern. **No Broker deep-link** (see Context #3).
- **AI Challenge:** an explicit, user-triggered "Challenge" action that follows
  the **ADR-0005 export/re-ingest pattern**, *not* the BYOK in-panel call. It
  assembles a board briefing + an export prompt, the user copies it into their
  own LLM, and pastes a JSON result back which the extension parses and renders
  as a curated/annotated board. There is **no automatic, keyed AI call** — the
  full BYOK in-panel structure stays in the backlog (consistent with Step 7b
  being deferred).
  - Reuse note: the JSON extraction in `strategy.ts` (`extractJson`) should be
    lifted into a shared helper; the trending result is **list-shaped**, so the
    parser must accept an array/list (unlike `parseStrategy`, which rejects
    arrays).
- **Relationship to PRD §11:** the in-extension Trending Board is the *manual
  sibling* of the external "Morning Call" routine, not its replacement. The
  routine (scheduled, autonomous, journaling) remains the post-v1 direction.

## Consequences

**Positive**

- Near-free first cut: base board is cached data + a new popup shell.
- AI curation reuses the proven export/re-ingest machinery and keeps the
  "never automatic / costs the user" principle intact.
- Gives the owner the discovery view now, without waiting for the external
  routine, and without standing up any backend.

**Negative**

- A new manifest surface (`browser_action`) and a popup app to maintain — the
  first UI not injected into a broker page.
- No Broker deep-link from a trending row is a real UX limitation, rooted in the
  one-directional ISIN→Broker-URL mapping (ADR-0006).
- "Trending Board" risks being confused with the per-Asset "Trend" signal;
  CONTEXT.md sharpens the distinction, code/UI must keep it.

## Alternatives Considered

- **In-extension, populated by the external routine** (extension = pure
  frontend, routine writes a snapshot it reads). Truer to PRD §11's split, but
  needs a routine→extension transport and makes the board useless until the
  routine exists. Deferred; the Apewisdom-driven board stands alone today.
- **No in-extension page; external routine only.** The original PRD §11 stance.
  Rejected for now because the owner wants an on-demand, in-browser discovery
  view, and the data is already sitting in the cache.
- **Side Panel tab / dedicated extension tab-page** instead of a popup. The Side
  Panel only exists on a Broker page (not global); a full tab-page is heavier and
  less glance-able than a popup.
- **Auto-run AI on popup open.** Violates the explicit-trigger / cost principle
  and burns BYOK budget; rejected.

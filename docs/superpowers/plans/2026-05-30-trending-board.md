# Trending Board — Implementation Plan

> Implements **ADR-0007** (incl. its 2026-05-30 refinements). TDD throughout:
> failing test first, then minimal code. Each task ends runnable + committed.

**Goal:** A toolbar (`browser_action`) popup with two sections — a market-wide
**Trending** list (top ~15 by Apewisdom mentions) and a **Favourites** companion
(current standing + 7-day sparkline). Rows expand (accordion) to full inline
intel via the existing ticker-keyed services. An on-demand AI **Challenge**
pre-filters the trending list via the ADR-0005 copy-out / paste-back flow; its
result is stored and overlaid per ticker with a staleness hint.

**Architecture:**
- Reuse everything ticker-keyed: `apewisdom`, `stocktwits`, `finnhub`,
  `barometer` (incl. `computeTrend` / `TREND_ARROW`), `Sparkline`, `ttl-cache`.
- The full Apewisdom snapshot is already cached; the popup reads it through a new
  service method + message (today only per-ticker `lookup` is exposed).
- The popup is a new surface under `src/popup/` (HTML + Preact app). It talks to
  the background via the existing message bus.
- Challenge = `src/lib/trending-briefing.ts` (payload + export prompt) +
  `src/lib/trending-challenge.ts` (list-shaped parser) + stored result.
- `extractJson` is lifted from `strategy.ts` into `src/lib/json.ts` (shared).

**Tech stack:** unchanged (TS, Vite + crxjs, Preact, Vitest, Firefox MV3).

---

## Task 1: Data model + snapshot list service + messages (TDD)

**Files:** `src/lib/apewisdom.ts`(+test), `src/background/apewisdom-service.ts`(+test),
`src/background/messages.ts`(+test), `src/background/index.ts`

- [ ] **Step 1:** Failing tests:
  - `apewisdom.ts`: snapshot entries now carry `name` (map `raw.name`); a raw
    entry without `name` yields `name: undefined`.
  - `apewisdom-service.ts`: new `board(limit)` returns rows
    `{ ticker, name, mentions, mentions24hAgo, rank }` sorted by `rank` asc,
    capped at `limit` (default 15), read from the same cached snapshot.
  - `messages.ts`: `trending:board` → `TrendingRow[]`; `favourites:board` →
    `FavouriteRow[]` where each row = `{ isin, ticker, standing: ApewisdomEntry | null, history: DailySnapshot[] }`.
- [ ] **Step 2:** Run the three test files → FAIL.
- [ ] **Step 3:** Implement:
  - Add `name?: string` to `ApewisdomEntry`; map it in `fetchApewisdomSnapshot`.
    (Backward compat: existing serialised snapshots lack `name` → `undefined`,
    UI falls back to ticker.)
  - `board(limit)` on `ApewisdomService` (ticker comes from the Map key).
  - `favouritesBoard()` composition (favourites list × apewisdom standing ×
    snapshot history) — add as a handler in `messages.ts` + wire fetchers.
  - Add the two message types, type guards, and `handleMessage` branches.
- [ ] **Step 4:** Tests green. **Step 5:** `npm run typecheck`.
- [ ] **Step 6:** Wire the new handlers in `background/index.ts`.
- [ ] **Step 7:** Commit `feat(trending): snapshot list service + board messages`.

## Task 2: Popup shell + manifest `action` (TDD where it applies)

**Files:** `manifest.config.ts`, `src/popup/index.html`, `src/popup/index.tsx`,
`src/popup/App.tsx`(+test), `src/popup/popup.css`

- [ ] **Step 1:** Add `action: { default_popup: "src/popup/index.html" }` to the
  manifest (Firefox MV3). Bump version.
- [ ] **Step 2:** Failing `App.test.tsx`: renders a "Trending" and a "Favourites"
  section heading and a loading state before data arrives.
- [ ] **Step 3:** Implement the popup entry (HTML + `render(<App/>)`) and an `App`
  that fetches `trending:board` + `favourites:board` on mount and shows the two
  section shells with loading/empty/error states. Width ~360–400px.
- [ ] **Step 4:** Tests green; `npm run build` → `dist/` includes the popup html.
- [ ] **Step 5:** Commit `feat(popup): toolbar popup shell with two sections`.

## Task 3: Trending section (TDD)

**Files:** `src/popup/TrendingSection.tsx`(+test), `src/popup/TrendingRow.tsx`(+test)

- [ ] **Step 1:** Failing tests: a row shows rank, ticker, name (fallback to
  ticker when name missing), mentions, and the correct `TREND_ARROW` for
  up/flat/down (reuse `computeTrend`); the section renders ~15 rows.
- [ ] **Step 2 → 4:** Implement, green, typecheck.
- [ ] **Step 5:** Commit `feat(trending): trending list section`.

## Task 4: Favourites section (TDD)

**Files:** `src/popup/FavouritesSection.tsx`(+test), `src/popup/FavouriteRow.tsx`(+test)

- [ ] **Step 1:** Failing tests: a favourite row shows ticker + current standing
  + a `Sparkline` from its history; empty-favourites shows a hint to pin Assets
  on a Broker page.
- [ ] **Step 2 → 4:** Implement (reuse the existing `Sparkline`), green, typecheck.
- [ ] **Step 5:** Commit `feat(trending): favourites section with sparkline`.

## Task 5: Accordion expand → inline intel (TDD)

**Files:** `src/popup/App.tsx`, `src/popup/ExpandedIntel.tsx`(+test)

- [ ] **Step 1:** Failing tests: only one row open at a time (accordion); opening
  a row dispatches the ticker-keyed lookups and renders Barometer/Buzz/Trend;
  News/Earnings appear only when a Finnhub key is present, otherwise a hint;
  external links (StockTwits/TradingView) shown via the existing pattern.
- [ ] **Step 2 → 4:** Implement accordion state + lazy dispatch (TTL caches dedupe),
  reuse barometer/aggregate display + `NewsSection` where practical.
- [ ] **Step 5:** Commit `feat(trending): accordion inline intel`.

## Task 6: AI Challenge — export, parse, render, persist (TDD)

**Files:** `src/lib/json.ts`(+test), `src/lib/strategy.ts` (refactor to shared
`extractJson`), `src/lib/trending-briefing.ts`(+test),
`src/lib/trending-challenge.ts`(+test), `src/popup/ChallengePanel.tsx`(+test),
`src/popup/App.tsx`

- [ ] **Step 1a:** Lift `extractJson` into `src/lib/json.ts` with its tests;
  refactor `strategy.ts` to import it (behaviour unchanged — run strategy tests).
- [ ] **Step 1b:** Failing tests for `trending-briefing.ts`: `assembleTrendingBriefing(rows)`
  emits a markdown list (rank, ticker, name, mentions, trend); `buildTrendingClipboardPayload`
  = `TRENDING_EXPORT_PROMPT` + briefing. The prompt asks the LLM to **pre-filter**:
  flag duds that don't deserve their trend, surface the genuinely worth-following,
  do its own research, and return a fenced `json` block.
- [ ] **Step 1c:** Failing tests for `trending-challenge.ts`: `parseTrendingChallenge(text)`
  → `{ summary, verdicts: Array<{ ticker, verdict: "signal"|"noise"|"watch", thesis, watch }> }`
  or null. Must accept a top-level array OR `{ summary, items: [...] }`; tolerate
  prose around the JSON (via shared `extractJson`); drop unknown `verdict` values.
- [ ] **Step 2 → 4:** Implement; green; typecheck.
- [ ] **Step 5:** `ChallengePanel` (TDD): a "Copy Challenge prompt" button
  (writes payload to clipboard), a paste textarea + "Apply" that parses and
  stores under `trending:challenge` as `{ summary, verdicts, ingestedAt, tickers }`.
  On the board, verdict badge + thesis overlay each trending row **by ticker**;
  header shows "Challenge as of <local time>"; if the current snapshot's ticker
  set differs from the stored `tickers`, show a subtle "board updated — re-run
  Challenge" hint. Tickers without a verdict stay neutral.
- [ ] **Step 6:** Commit `feat(trending): AI challenge pre-filter (export + reingest)`.

## Task 7: Full suite + manual verification

- [ ] `npm run typecheck && npm test` green; `npm run build` clean.
- [ ] **Interactive (Firefox):** load `dist/manifest.json`; click the toolbar
  icon → popup shows Trending + Favourites; expand a row → intel fills; copy the
  Challenge prompt, run it in an external LLM, reopen the popup, paste the JSON →
  verdict badges appear; let the board refresh → staleness hint shows.

## Done criteria
- Toolbar popup renders both sections from cached data with no new upstream fetch
  for the base lists.
- Accordion intel reuses existing services; News/Earnings gated on Finnhub key.
- Challenge round-trips through copy-out / paste-back, persists, overlays by
  ticker, and signals staleness.
- All tests + typecheck green; build loadable.

## Deferred (intentionally out)
- BYOK in-panel/keyed Challenge call (stays in BACKLOG, Step 7b).
- Favouriting from the board (needs reverse ticker→ISIN; not available).
- Challenge over the Favourites section (trending-only by decision).
- The external "Morning Call" cron routine (PRD §11, separate post-v1 track).

# Manual Cache Refresh (F5) — Implementation Plan

> Implements PRD **F5**. A ↻ button in the Side Panel header force-refetches the
> current Asset's per-Asset sources (Apewisdom, StockTwits, Finnhub News +
> Earnings), bypassing their TTLs, then goes on a **3-minute per-ISIN cooldown**
> persisted in `storage.local`. TDD throughout.
>
> Decisions (grilled 2026-05-31):
> - **Scope:** all per-Asset sources actually fed into the content flow — Apewisdom,
>   StockTwits, Finnhub News, Finnhub Earnings. (Tradestie is not wired into the
>   aggregate today, so it is out of scope.) ISIN→Ticker (permanent) and the Daily
>   Snapshot are untouched.
> - **Cooldown:** `refresh:<isin>` = last-refreshed epoch ms in `storage.local`;
>   survives panel close and SPA navigation. 3 min.
> - **Force mechanism:** an optional `force` flag threaded message → handler →
>   service → `TtlCache.get(key, { force })`, which skips the freshness check and
>   refetches + overwrites.
> - **UI:** button disabled during cooldown (title shows remaining), re-enabled
>   exactly at expiry via a scheduled `setTimeout`. No per-second ticking.

## Task 1: `TtlCache` gains a force option — TDD

**Files:** `src/lib/ttl-cache.ts`, `src/lib/ttl-cache.test.ts`

- [ ] Failing test: `get(key, { force: true })` refetches and overwrites even when
  a fresh entry exists; without force the fresh entry is still returned (existing
  behaviour unchanged).
- [ ] Add optional `options?: { force?: boolean }` to `TtlCache.get`; when
  `force`, skip the freshness short-circuit, fetch, store, return.
- [ ] Green + typecheck. Commit `feat(cache): force option bypasses TTL`.

## Task 2: Thread `force` through services, messages, handlers — TDD

**Files:** `src/background/stocktwits-service.ts`, `apewisdom-service.ts`,
`finnhub-service.ts` (+ their tests), `src/background/messages.ts`,
`src/background/messages.test.ts`

- [ ] Failing tests: each service `lookup`/`news`/`earnings` forwards `force` to
  its cache (assert a fresh entry is bypassed when `force`); `handleMessage`
  passes `message.force` to the matching handler.
- [ ] Add optional `force?: boolean` param to `stocktwits.lookup`,
  `apewisdom.lookup`, `finnhub.news`, `finnhub.earnings`, each forwarding to
  `cache.get(key, { force })`. (apewisdom forces the whole shared snapshot — fine.)
- [ ] Add optional `force?: boolean` to `ApewisdomLookupMessage`,
  `StockTwitsLookupMessage`, `FinnhubNewsLookupMessage`,
  `FinnhubEarningsLookupMessage`; widen the four handler types to accept
  `(ticker, force?)`; pass `message.force` in `handleMessage`. Type guards are
  unchanged (force is optional).
- [ ] Wire `force` through in `background/index.ts` handler lambdas.
- [ ] Green + typecheck. Commit `feat(messages): force flag on per-asset lookups`.

## Task 3: Side Panel refresh button — TDD

**Files:** `src/content/SidePanel.tsx`, `src/content/SidePanel.test.tsx`,
`src/content/sidePanel.css`

- [ ] Failing tests: a ↻ button renders in `header-actions` when a ticker is
  present; clicking it calls a new `onRefresh`; when `refreshDisabledUntil` is in
  the future the button is `disabled` and its `title` mentions the wait; with no
  cooldown it is enabled. Existing SidePanel assertions stay green.
- [ ] Add props `onRefresh: () => void` and `refreshDisabledUntil: number | null`.
  Render the button next to the star; `disabled={Date.now() < (refreshDisabledUntil ?? 0)}`.
- [ ] Green + typecheck. Commit `feat(panel): manual refresh button`.

## Task 4: Content-script glue — cooldown + force dispatch

**Files:** `src/content/index.tsx`

- [ ] `REFRESH_PREFIX = "refresh:"`, `REFRESH_COOLDOWN_MS = 180_000`.
- [ ] Track `refreshDisabledUntil: number | null`. On navigation, load
  `refresh:<isin>` and set it; schedule a `setTimeout` to clear + `paint()` at
  expiry (clear any prior timer on nav).
- [ ] `onRefresh()`: ignore if still on cooldown or no ticker. Reset the four
  source states to `undefined` (loading), call `dispatchSentimentLookups` /
  `dispatchFinnhubLookups` with `force: true` (thread an optional `force` arg into
  those two helpers), persist `refresh:<isin> = Date.now()`, set
  `refreshDisabledUntil` and schedule the re-enable timer, `paint()`.
- [ ] Pass `onRefresh` + `refreshDisabledUntil` to `<SidePanel>`.
- [ ] `npm run typecheck` green; `npm run build` clean.
- [ ] Commit `feat(content): wire manual refresh with per-isin cooldown`.

## Task 5: Full suite + manual verification

- [ ] `npm run typecheck && npm test` green; `npm run build` clean.
- [ ] Interactive (Firefox): open the Side Panel, click ↻ → sources show a brief
  loading state and refill; button disables for 3 min (title shows remaining);
  navigate away and back within 3 min → still disabled; after expiry → enabled.

## Done criteria
- ↻ refetches Apewisdom / StockTwits / News / Earnings for the current Asset,
  bypassing TTL.
- 3-minute per-ISIN cooldown persisted across nav; button auto-re-enables at expiry.
- All tests + typecheck green; build loadable.

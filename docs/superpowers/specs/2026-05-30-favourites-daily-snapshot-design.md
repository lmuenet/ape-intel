# Favourites + Daily Snapshot + 7-Day Sparkline (Step 6) — Design

Status: Accepted
Date: 2026-05-30

Implements PRD §6 **F6** (Favourites & Daily Snapshot) and build-order Step 6.
Keeps the daily snapshot in a structured, exportable shape per PRD §11 (forward
pressure for the post-v1 Morning Call routine), without building any export UI
in this step.

---

## 1. Goal

Let the user pin Assets as **Favourites** (star toggle in the Side Panel, cap
20). A once-per-day background job fetches Apewisdom data for every Favourite
and appends it to a per-Asset 7-day ring buffer in `storage.local`. The Side
Panel renders a 7-day **mentions-momentum sparkline** only for Favourites.

## 2. Architecture / module layout

Follows the existing adapter pattern: pure libs → background service →
message routing → content wiring → UI.

**Pure libs (no I/O, fully unit-tested):**

- `src/lib/favourites.ts`
  - `Favourite = { isin: string; ticker: string }`
  - Pure list ops: `hasFavourite`, `toggleFavourite` (cap 20: toggling **on**
    when already at 20 and not present is a no-op returning the unchanged
    list), `removeFavourite`.
- `src/lib/snapshot-history.ts`
  - `DailySnapshot = { date: string; mentions: number; rank: number | null }`
    (`date` is a UTC `YYYY-MM-DD` string)
  - `utcDay(now: number): string` — UTC day stamp.
  - `isSnapshotDue(lastDate: string | undefined, today: string): boolean` —
    true when `lastDate !== today`.
  - `appendDay(history, record, max = 7)` — append, replace a same-date entry
    if present (idempotent re-run), keep the most recent `max` by date.
- `src/lib/sparkline.ts`
  - `sparklinePoints(values: number[], width: number, height: number): string`
    — pure mapping of a number series to an SVG `points` string (min/max
    normalised; a flat series renders on the mid-line).

**Background services:**

- `src/background/favourites-service.ts` — reads/writes the `favourites` list
  in the store. `get(): Favourite[]`, `toggle(fav): boolean` (returns new
  membership state; deletes `snapshot:history:<isin>` when removing),
  `has(isin): boolean`.
- `src/background/snapshot-service.ts` — the daily job + history reader.
  - `runIfDue(now): Promise<void>` — if `isSnapshotDue(lastDate, utcDay(now))`:
    fetch the Apewisdom snapshot **once**, then for each Favourite read its
    entry (absent → `{ mentions: 0, rank: null }`), `appendDay` into
    `snapshot:history:<isin>`, finally set `snapshot:lastDate = utcDay(now)`.
  - `history(isin): Promise<DailySnapshot[]>` — for the UI.
  - Injected dependencies: `KvStore`, a Favourites source, an Apewisdom
    fetcher, and `now` — so it is testable with fake timers and an in-memory
    store.

**Storage keys:** `favourites` (Favourite[]), `snapshot:lastDate`
(YYYY-MM-DD), `snapshot:history:<isin>` (DailySnapshot[]).

## 3. Favourites

- Star toggle lives in the Side Panel header next to the ticker, **only
  visible when a US-ticker is resolved** (every Favourite is guaranteed to
  have a ticker, so the snapshot job can always fetch data).
- Toggling on when already at 20 entries → no-op + a short inline "max 20"
  hint.
- Un-favouriting deletes the Asset's `snapshot:history:<isin>` (bounded
  storage, PRD §7).
- Messages: `favourites:toggle` (`{ isin, ticker }`) → new boolean state;
  `favourites:has` (`{ isin }`) → boolean.

## 4. Daily snapshot job

- Add the `alarms` permission to the manifest.
- A `daily-snapshot` alarm fires **hourly** and calls `runIfDue`; the UTC-day
  guard makes this idempotent (at most one snapshot per UTC day). `runIfDue`
  also runs on `runtime.onStartup` and `runtime.onInstalled`, so a day the
  browser was closed is caught up at the next launch. `periodInMinutes` is a
  tunable knob.
- A Favourite ticker absent from Apewisdom's top-250 that day is recorded as
  `{ mentions: 0, rank: null }`, keeping the daily cadence gap-free.
- UTC is the cutoff (deterministic, easy to test). Switching to local time
  later is a one-liner in `utcDay`.

## 5. Sparkline (UI)

- Its own Side Panel section, **only rendered for Favourites**.
- Message `snapshot:history` (`{ isin }`) → `DailySnapshot[]`.
- States: `undefined` = Loading; `< 2` points → "Collecting data (n/7)";
  `≥ 2` points → small inline SVG of the mentions series + the current
  mentions value.

## 6. Scope boundaries (this step)

- **No export UI** — that is Step 7/8. Only the storage format is kept
  export-friendly (object records, clean JSON).
- **No Favourites management screen** — just the star toggle in the panel and
  the sparkline (covers PRD F6).
- Snapshot stays **Apewisdom-only**. Richer per-day data (barometer / all three
  sources) is forward pressure per the Daily Trading Loop spec §6, not in scope
  here.

## 7. Test strategy

- **Pure libs:** favourites ops incl. the 20-cap; ring-buffer
  append/trim/same-date-replace; `isSnapshotDue` (empty / yesterday / today);
  `sparklinePoints` (normal, flat, single value).
- **Services:** in-memory `KvStore` + injected Apewisdom fetcher +
  `vi.useFakeTimers`. Cases: not due → no fetch; due → exactly one fetch, every
  Favourite gets a record; absent ticker → `0`/`null`; `lastDate` advanced;
  `history` getter; un-favourite deletes history.
- **Messages:** routing of the three new message types (`favourites:toggle`,
  `favourites:has`, `snapshot:history`).
- **Content wiring:** no unit test (orchestration layer) — verified via
  typecheck + `npm test` + build + manual load.

## 8. Build order (staged plan)

One spec, one staged implementation plan, each stage runnable/testable:

1. **Favourites** — `favourites.ts` + `favourites-service.ts` + messages +
   star toggle in the panel.
2. **Daily snapshot job** — `snapshot-history.ts` + `snapshot-service.ts` +
   alarms/startup wiring + manifest `alarms` permission.
3. **Sparkline** — `sparkline.ts` + Side Panel section + `snapshot:history`
   message + content wiring.

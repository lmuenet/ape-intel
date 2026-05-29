# Finnhub News + Earnings (Step 5) — Design

Status: Accepted
Date: 2026-05-29

Implements PRD §F4 (News & Earnings) and §5 (Finnhub data source). Seeds the
"catalyst-grade" news direction recorded in PRD §11 / the Daily Trading Loop
vision (`2026-05-29-daily-trading-loop-design.md`).

---

## Goal

Add a **News** section (Top 5 of the last 7 days, English, from Finnhub
`/company-news`) and a **next Earnings Date** (with consensus EPS estimate) to
the Side Panel, each item lightly tagged with a **catalyst** category so the
data is structured and exportable for the future Morning Call.

## Scope decisions (locked)

- **Finnhub API key:** a minimal inline key field in the News section (Settings
  UI proper is Step 8). The key is stored in `storage.local` under
  `finnhub:apiKey`. No key → the section shows the input; with a key → news.
- **News depth:** Top-5 plus a light catalyst tag per item.
- **Alpha Vantage fallback:** deferred (PRD says "emergency only"). Step 5 is
  Finnhub-only. A bad/expired key surfaces as an error state, not a fallback.

## Architecture

Follows the established adapter pattern exactly:
`src/lib/<source>.ts` (pure fetch, injected `FetchFn`) → `src/background/
<source>-service.ts` (TtlCache wrapper) → `messages.ts` + `background/index.ts`
(wiring) → `content/index.tsx` (dispatch + state + paint) → `manifest.config.ts`
(host permission).

```
content/index.tsx
  reads finnhub:apiKey from storage.local (gate)
  key? → send finnhub:news + finnhub:earnings   no key? → NewsSection shows input
        │                                                        │ onSaveKey → storage.local → re-dispatch
        ▼
background/index.ts → finnhub-service (TtlCache: news 30m / earnings 24h)
  fetcher reads finnhub:apiKey from store; no key → null
        ▼
lib/finnhub.ts  (apiKey + FetchFn + now injected)
  fetchCompanyNews → NewsItem[]   fetchNextEarnings → EarningsDate | null
        │ classifyCatalyst(headline)
        ▼
lib/catalyst.ts (pure)
```

## Data model

```ts
// src/lib/catalyst.ts
export type CatalystTag =
  | "earnings" | "m&a" | "guidance" | "analyst" | "regulatory" | "product" | "news";
export function classifyCatalyst(headline: string): CatalystTag;

// src/lib/finnhub.ts
export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number;        // unix seconds (Finnhub `datetime`)
  catalyst: CatalystTag;
}
export interface EarningsDate {
  date: string;            // YYYY-MM-DD
  epsEstimate: number | null;
}
```

## `lib/catalyst.ts`

`classifyCatalyst` matches the headline (case-insensitive) against an ordered
list of keyword groups; first match wins, default `"news"`:

| Tag          | Keywords (illustrative, case-insensitive) |
|--------------|--------------------------------------------|
| `earnings`   | earnings, EPS, quarterly results, beats/misses estimates, revenue |
| `guidance`   | guidance, outlook, forecast, raises/cuts/lowers (when not earnings) |
| `m&a`        | acquir, merger, buyout, takeover, acquisition, stake |
| `analyst`    | upgrade, downgrade, price target, initiates, rating |
| `regulatory` | FDA, approval, lawsuit, SEC, investigation, antitrust, probe |
| `product`    | launch, unveil, release, product |

Ordering note: `earnings` is checked before `guidance` (guidance often appears
in earnings coverage); `m&a` before `product`. The exact regexes are fixed in
the implementation plan. This is a deliberately small heuristic — good enough to
group the Top-5 and to feed the Morning Call later; not an NLP classifier.

## `lib/finnhub.ts`

- `fetchCompanyNews(ticker, apiKey, fetchFn, now = Date.now()): Promise<NewsItem[]>`
  - `from = now − 7 days`, `to = now`, both formatted `YYYY-MM-DD`.
  - URL: `https://finnhub.io/api/v1/company-news?symbol=<T>&from=<F>&to=<TO>&token=<KEY>`.
  - Non-2xx → throw `Error("Finnhub news returned <status>")`.
  - Map raw `{ headline, source, url, datetime }` → `NewsItem`, drop entries
    missing headline/url, sort by `datetime` desc, take first 5, set
    `catalyst = classifyCatalyst(headline)`.
- `fetchNextEarnings(ticker, apiKey, fetchFn, now = Date.now()): Promise<EarningsDate | null>`
  - URL: `https://finnhub.io/api/v1/calendar/earnings?symbol=<T>&token=<KEY>`.
  - Non-2xx → throw `Error("Finnhub earnings returned <status>")`.
  - From `earningsCalendar`, keep entries with `date >= todayYYYYMMDD(now)`,
    pick the earliest, return `{ date, epsEstimate: epsEstimate ?? null }`.
    No upcoming entry → `null`.

## `background/finnhub-service.ts`

```ts
export interface FinnhubService {
  news(ticker: string): Promise<NewsItem[] | null>;
  earnings(ticker: string): Promise<EarningsDate | null>;
}
export function createFinnhubService(store: KvStore, fetchFn): FinnhubService
```

- Reads `finnhub:apiKey` from `store` at fetch time. No key → resolve `null`
  (the cache still stores `null`, so a missing key does not hammer the network;
  the content layer is the primary gate anyway).
- News cache: `createTtlCache<NewsItem[] | null>(store, fetcher, { ttlMs: 30*60_000, keyPrefix: "finnhub-news" })`.
- Earnings cache: `ttlMs: 24*60*60_000, keyPrefix: "finnhub-earnings"`.

## Messages

```ts
interface FinnhubNewsLookupMessage { type: "finnhub:news"; ticker: string }
interface FinnhubEarningsLookupMessage { type: "finnhub:earnings"; ticker: string }
```

`handleMessage` routes them to `finnhub.news(ticker)` / `finnhub.earnings(ticker)`.
`MessageHandlers` gains `lookupFinnhubNews` and `lookupFinnhubEarnings`.

## Content orchestration (`content/index.tsx`)

- New module state: `currentNews: NewsItem[] | null | undefined`,
  `currentEarnings: EarningsDate | null | undefined`,
  `finnhubKey: string | null | undefined` (undefined = not yet read).
- On each ISIN change: reset the three to `undefined` (key re-read each nav).
- After ticker resolves to a non-null ticker: read `finnhub:apiKey` from
  `storage.local` (via `browserStorageKvStore`, the same store the ticker cache
  uses). Set `finnhubKey`. If a key exists, dispatch `finnhub:news` +
  `finnhub:earnings` (generation-guarded, like the sentiment lookups). If not,
  leave news/earnings `undefined` and let `NewsSection` render the input.
- `onSaveKey(key)`: write `finnhub:apiKey` to `storage.local`, set `finnhubKey`,
  dispatch the two lookups for the current ticker.
- Uncovered ticker (null): set news/earnings to `null`.
- Pass `news`, `earnings`, `finnhubKey`, `onSaveKey` to `SidePanel`.

## Side Panel UI

New sections rendered after `ApewisdomSection`, before `ExternalLinksBar`:

1. **`EarningsRow`** — label "Next earnings"; shows date + "EPS est. <n>" when
   present; placeholder states for loading / none / error. Visible but compact,
   not a headline element (PRD F4).
2. **`NewsSection`** — title "News":
   - `finnhubKey` falsy → a small `<form>` with a text input (placeholder
     "Finnhub API key") and a Save button; submit calls `onSaveKey(value)`.
   - key present:
     - `news === undefined` → "Loading…"
     - `news === null` → "Couldn't load news."
     - `news.length === 0` → "No news in the last 7 days."
     - else → up to 5 rows: headline (anchor to `url`, `target="_blank"
       rel="noopener noreferrer"`), source, relative/short date, and a catalyst
       tag chip.

## Coverage states summary

| Condition                         | News section shows            |
|-----------------------------------|-------------------------------|
| No `finnhub:apiKey`               | key input form                |
| Key present, request in flight    | "Loading…"                    |
| Key present, fetch error/bad key  | "Couldn't load news."         |
| Key present, empty result         | "No news in the last 7 days." |
| Key present, results              | Top-5 list with catalyst tags |

## Testing (TDD)

- `catalyst.test.ts` — each tag from a representative headline; ordering cases
  (earnings-vs-guidance, m&a-vs-product); default `news`.
- `finnhub.test.ts` — news URL carries token + 7-day `from`/`to` window
  (injected `now`); maps/sorts/top-5; catalyst applied; drops malformed entries;
  earnings picks earliest future date with EPS estimate, `null` when none;
  throws on non-2xx for both.
- `finnhub-service.test.ts` — TTL caching for news (30m) and earnings (24h);
  returns `null` when no key in store; reads key from store.
- `messages.test.ts` — routes `finnhub:news` / `finnhub:earnings`.
- `NewsSection` / `SidePanel` tests — key input when no key; save callback;
  news list with tags; earnings row; each placeholder state.

## Deferred (not Step 5)

Full Settings UI (Step 8), Alpha Vantage fallback, invalid-key-vs-empty
distinction, news pagination, German-language news, summaries/images.

# Apewisdom Adapter + Side Panel (Build Step 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click the Badge → a Side Panel opens with raw Apewisdom data (mentions, sentiment 0–100, rank, 24h trend) for the current ticker. Single-source-only — Tradestie/StockTwits and the fused Barometer come in Step 4.

**Architecture:**
- Apewisdom API call lives in the background script (CORS), same pattern as OpenFIGI.
- A generic `createTtlCache(store, fetcher, { ttlMs, keyPrefix })` replaces hand-rolled TTL handling — reused in Steps 4 (Tradestie/StockTwits) and 5 (News/Earnings).
- The Apewisdom payload for the whole trending list is fetched once per TTL window (15 min per PRD) and cached as a single value under `apewisdom:snapshot`. Per-ticker lookup is an in-memory map walk inside the background. This is dramatically simpler than per-ticker fetches and matches Apewisdom's "trending" semantics — a ticker not in the snapshot means "not currently trending", which we surface as "no data".
- Side Panel: minimal Preact component anchored to `document.body` next to the Badge. Open/closed boolean held in content-script module scope (per ADR-0003: persists across SPA navigation; resets on full reload). Badge becomes a button that toggles the panel.

**Tech Stack:** No new deps.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `src/lib/apewisdom.ts` | `fetchApewisdomSnapshot(fetch, pages?) → Promise<ApewisdomSnapshot>` returns a map keyed by ticker |
| `src/lib/apewisdom.test.ts` | Vitest with fetch stubs |
| `src/lib/ttl-cache.ts` | Generic TTL read-through cache over `KvStore` |
| `src/lib/ttl-cache.test.ts` | Vitest with fake timers |
| `src/background/apewisdom-service.ts` | Composes TTL cache + adapter + ticker-to-entry lookup |
| `src/background/apewisdom-service.test.ts` | Vitest |
| `src/background/messages.ts` | Extend: add `ApewisdomLookupMessage`, route in `handleMessage` |
| `src/background/messages.test.ts` | Extend with apewisdom dispatch cases |
| `src/background/index.ts` | Wire new service into the message handler |
| `src/content/Badge.tsx` | Make Badge a `<button>` accepting `onClick` |
| `src/content/Badge.test.tsx` | Cover click handler |
| `src/content/badge.css` | Tweak: button reset (no native chrome) |
| `src/content/SidePanel.tsx` | New component |
| `src/content/SidePanel.test.tsx` | Vitest |
| `src/content/sidePanel.css` | Styles |
| `src/content/index.tsx` | Orchestrate panel state, fetch apewisdom on ticker known, render |
| `manifest.config.ts` | Add `https://apewisdom.io/*` host_permission, bump 0.0.5 |

---

## Apewisdom data shape

Endpoint: `GET https://apewisdom.io/api/v1.0/filter/all-stocks/page/{n}` (1-indexed).

Response per page:
```json
{
  "count": 12345,
  "pages": 248,
  "current_page": 1,
  "results": [
    { "rank": 1, "ticker": "TSLA", "name": "Tesla", "mentions": 234, "upvotes": 1102, "rank_24h_ago": 2, "mentions_24h_ago": 180, "sentiment": "bullish", "sentiment_score": 73 }
  ]
}
```

We fetch the first **5 pages** (250 tickers) and merge into a single `Map<string, ApewisdomEntry>`. A ticker absent from the merged map → "not currently trending" → the Side Panel shows "no Apewisdom data".

`ApewisdomEntry`:
```ts
interface ApewisdomEntry {
  rank: number;
  mentions: number;
  mentions24hAgo: number;
  sentimentScore: number; // 0-100
}
```

(`name`, `sentiment` text label, `upvotes`, `rank_24h_ago` — not needed yet; dropped at adapter boundary to keep cache size predictable.)

---

## Task 1: Apewisdom adapter with TDD

**Files:**
- Create: `src/lib/apewisdom.ts`
- Create: `src/lib/apewisdom.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchApewisdomSnapshot } from "./apewisdom";

const okPage = (results: Array<Record<string, unknown>>): Response =>
  new Response(JSON.stringify({ results }), { status: 200 });

const entry = (ticker: string, rank: number) => ({
  rank,
  ticker,
  name: ticker,
  mentions: 100 - rank,
  upvotes: 1,
  rank_24h_ago: rank + 1,
  mentions_24h_ago: 90 - rank,
  sentiment: "bullish",
  sentiment_score: 70 - rank,
});

describe("fetchApewisdomSnapshot", () => {
  it("requests pages 1..N and merges into a single map keyed by ticker", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(okPage([entry("TSLA", 1), entry("AAPL", 2)]))
      .mockResolvedValueOnce(okPage([entry("NVDA", 51)]));

    const map = await fetchApewisdomSnapshot(fetchFn, 2);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "https://apewisdom.io/api/v1.0/filter/all-stocks/page/1",
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "https://apewisdom.io/api/v1.0/filter/all-stocks/page/2",
    );
    expect(map.get("TSLA")).toEqual({
      rank: 1,
      mentions: 99,
      mentions24hAgo: 89,
      sentimentScore: 69,
    });
    expect(map.get("NVDA")).toEqual({
      rank: 51,
      mentions: 49,
      mentions24hAgo: 39,
      sentimentScore: 19,
    });
    expect(map.size).toBe(3);
  });

  it("defaults to 5 pages when no count is given", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okPage([]));
    await fetchApewisdomSnapshot(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it("throws on non-2xx response", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(fetchApewisdomSnapshot(fetchFn, 1)).rejects.toThrow(/429/);
  });

  it("returns an empty map when all pages have zero results", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okPage([]));
    const map = await fetchApewisdomSnapshot(fetchFn, 3);
    expect(map.size).toBe(0);
  });
});
```

- [ ] **Step 2: run tests → FAIL.**

- [ ] **Step 3: Implement `src/lib/apewisdom.ts`**

```ts
const ENDPOINT = "https://apewisdom.io/api/v1.0/filter/all-stocks/page";
const DEFAULT_PAGES = 5;

export interface ApewisdomEntry {
  rank: number;
  mentions: number;
  mentions24hAgo: number;
  sentimentScore: number;
}

export type ApewisdomSnapshot = Map<string, ApewisdomEntry>;

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawEntry {
  ticker: string;
  rank: number;
  mentions: number;
  mentions_24h_ago: number;
  sentiment_score: number;
}

interface RawPage {
  results: RawEntry[];
}

export async function fetchApewisdomSnapshot(
  fetchFn: FetchFn,
  pages: number = DEFAULT_PAGES,
): Promise<ApewisdomSnapshot> {
  const map: ApewisdomSnapshot = new Map();
  for (let page = 1; page <= pages; page++) {
    const response = await fetchFn(`${ENDPOINT}/${page}`);
    if (!response.ok) {
      throw new Error(`Apewisdom returned ${response.status}`);
    }
    const body = (await response.json()) as RawPage;
    for (const raw of body.results ?? []) {
      map.set(raw.ticker, {
        rank: raw.rank,
        mentions: raw.mentions,
        mentions24hAgo: raw.mentions_24h_ago,
        sentimentScore: raw.sentiment_score,
      });
    }
  }
  return map;
}
```

- [ ] **Step 4: tests pass 4/4.**
- [ ] **Step 5: typecheck exit 0.**
- [ ] **Step 6: Commit**

```
git add src/lib/apewisdom.ts src/lib/apewisdom.test.ts
git commit -m "feat(lib): apewisdom adapter — paginated snapshot to ticker map"
```

---

## Task 2: Generic TTL cache with TDD

**Files:**
- Create: `src/lib/ttl-cache.ts`
- Create: `src/lib/ttl-cache.test.ts`

### Behaviour
- `createTtlCache(store, fetcher, { ttlMs, keyPrefix })` → `{ get(key) }`.
- Stored shape: `{ value: T, fetchedAt: number }` under `${keyPrefix}:${key}`.
- On get: read; if entry exists AND `Date.now() - entry.fetchedAt < ttlMs`, return `value`. Else call fetcher, persist with `fetchedAt = Date.now()`, return.
- On fetcher throw: do NOT persist, re-throw.
- Stored `null` values respected (no re-fetch when fresh).

- [ ] **Step 1: Tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "./kv-store";
import { createTtlCache } from "./ttl-cache";

const TTL = 1000;

describe("createTtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("calls the fetcher on miss and persists with the current timestamp", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("hello");
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    expect(await cache.get("a")).toBe("hello");
    expect(fetcher).toHaveBeenCalledWith("a");
    expect(await store.get("p:a")).toEqual({
      value: "hello",
      fetchedAt: Date.now(),
    });
  });

  it("returns the cached value within the ttl without refetching", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("hello");
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    await cache.get("a");
    vi.advanceTimersByTime(TTL - 1);
    expect(await cache.get("a")).toBe("hello");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches once the ttl has elapsed", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    await cache.get("a");
    vi.advanceTimersByTime(TTL + 1);
    expect(await cache.get("a")).toBe("second");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches null values just like real ones", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue(null);
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("a")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not persist when the fetcher throws", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    await expect(cache.get("a")).rejects.toThrow("boom");
    expect(await store.get("p:a")).toBeUndefined();
  });
});
```

- [ ] **Step 2: run tests → FAIL.**

- [ ] **Step 3: Implement `src/lib/ttl-cache.ts`**

```ts
import type { KvStore } from "./kv-store";

export interface TtlCacheOptions {
  ttlMs: number;
  keyPrefix: string;
}

interface CachedEntry<T> {
  value: T;
  fetchedAt: number;
}

export interface TtlCache<T> {
  get(key: string): Promise<T>;
}

export function createTtlCache<T>(
  store: KvStore,
  fetcher: (key: string) => Promise<T>,
  options: TtlCacheOptions,
): TtlCache<T> {
  const fullKey = (key: string): string => `${options.keyPrefix}:${key}`;

  return {
    async get(key: string): Promise<T> {
      const entry = await store.get<CachedEntry<T>>(fullKey(key));
      if (entry !== undefined && Date.now() - entry.fetchedAt < options.ttlMs) {
        return entry.value;
      }
      const fresh = await fetcher(key);
      await store.set(fullKey(key), { value: fresh, fetchedAt: Date.now() });
      return fresh;
    },
  };
}
```

- [ ] **Step 4: tests pass 5/5.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: Commit**

```
git add src/lib/ttl-cache.ts src/lib/ttl-cache.test.ts
git commit -m "feat(lib): generic ttl read-through cache"
```

---

## Task 3: Apewisdom service in background

**Files:**
- Create: `src/background/apewisdom-service.ts`
- Create: `src/background/apewisdom-service.test.ts`

The service composes the TTL cache with the adapter, exposing `lookupApewisdom(ticker) → ApewisdomEntry | null`. Whole-snapshot caching means all per-ticker lookups within the TTL window cost one network call.

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { createApewisdomService } from "./apewisdom-service";

const entry = (rank: number): ApewisdomEntry => ({
  rank,
  mentions: 100,
  mentions24hAgo: 80,
  sentimentScore: 60,
});

describe("createApewisdomService", () => {
  it("returns the entry for a ticker present in the snapshot", async () => {
    const store = createInMemoryKvStore();
    const snapshot = new Map([["AAPL", entry(5)]]);
    const fetcher = vi.fn().mockResolvedValue(snapshot);
    const service = createApewisdomService(store, fetcher);

    expect(await service.lookup("AAPL")).toEqual(entry(5));
  });

  it("returns null for a ticker absent from the snapshot", async () => {
    const store = createInMemoryKvStore();
    const snapshot = new Map([["TSLA", entry(1)]]);
    const fetcher = vi.fn().mockResolvedValue(snapshot);
    const service = createApewisdomService(store, fetcher);

    expect(await service.lookup("NOPE")).toBeNull();
  });

  it("fetches the snapshot at most once within the ttl window", async () => {
    const store = createInMemoryKvStore();
    const snapshot = new Map([["AAPL", entry(5)], ["TSLA", entry(1)]]);
    const fetcher = vi.fn().mockResolvedValue(snapshot);
    const service = createApewisdomService(store, fetcher);

    await service.lookup("AAPL");
    await service.lookup("TSLA");
    await service.lookup("NOPE");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: run tests → FAIL.**

- [ ] **Step 3: Implement `src/background/apewisdom-service.ts`**

```ts
import type { KvStore } from "../lib/kv-store";
import type { ApewisdomEntry, ApewisdomSnapshot } from "../lib/apewisdom";
import { createTtlCache } from "../lib/ttl-cache";

const SNAPSHOT_KEY = "snapshot";
const TTL_MS = 15 * 60 * 1000; // 15 minutes per PRD

export type ApewisdomFetcher = () => Promise<ApewisdomSnapshot>;

export interface ApewisdomService {
  lookup(ticker: string): Promise<ApewisdomEntry | null>;
}

interface SerialisedSnapshot {
  entries: Array<[string, ApewisdomEntry]>;
}

export function createApewisdomService(
  store: KvStore,
  fetcher: ApewisdomFetcher,
): ApewisdomService {
  const cache = createTtlCache<SerialisedSnapshot>(
    store,
    async () => ({ entries: Array.from((await fetcher()).entries()) }),
    { ttlMs: TTL_MS, keyPrefix: "apewisdom" },
  );

  return {
    async lookup(ticker: string): Promise<ApewisdomEntry | null> {
      const serialised = await cache.get(SNAPSHOT_KEY);
      const map = new Map(serialised.entries);
      return map.get(ticker) ?? null;
    },
  };
}
```

(Maps don't survive `JSON.stringify` → we serialise to `entries`. This is the cost of putting the whole snapshot under one cache key. Step 4 may revisit if Tradestie/StockTwits adopt a different pattern.)

- [ ] **Step 4: tests pass 3/3.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: Commit**

```
git add src/background/apewisdom-service.ts src/background/apewisdom-service.test.ts
git commit -m "feat(background): apewisdom service — ttl-cached snapshot lookup"
```

---

## Task 4: Extend message dispatcher

**Files:**
- Modify: `src/background/messages.ts`
- Modify: `src/background/messages.test.ts`

Adds `ApewisdomLookupMessage = { type: "apewisdom:lookup"; ticker: string }`. `handleMessage` grows a second branch and a second dependency (`lookupApewisdom`). Returns `Promise<ApewisdomEntry | null> | undefined` in addition to the existing string|null branch — broaden the return type.

- [ ] **Step 1: Replace `src/background/messages.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { handleMessage } from "./messages";

const noopApewisdom = vi.fn();
const noopTicker = vi.fn();

describe("handleMessage", () => {
  it("delegates ticker:lookup to fetchTicker", async () => {
    const fetchTicker = vi.fn().mockResolvedValue("AAPL");
    const result = handleMessage(
      { type: "ticker:lookup", isin: "US0378331005" },
      fetchTicker,
      noopApewisdom,
    );
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("AAPL");
    expect(fetchTicker).toHaveBeenCalledWith("US0378331005");
  });

  it("delegates apewisdom:lookup to lookupApewisdom", async () => {
    const entry: ApewisdomEntry = {
      rank: 5,
      mentions: 100,
      mentions24hAgo: 80,
      sentimentScore: 60,
    };
    const lookupApewisdom = vi.fn().mockResolvedValue(entry);
    const result = handleMessage(
      { type: "apewisdom:lookup", ticker: "AAPL" },
      noopTicker,
      lookupApewisdom,
    );
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe(entry);
    expect(lookupApewisdom).toHaveBeenCalledWith("AAPL");
  });

  it("propagates fetcher rejections (ticker)", async () => {
    const fetchTicker = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      handleMessage(
        { type: "ticker:lookup", isin: "US0378331005" },
        fetchTicker,
        noopApewisdom,
      ),
    ).rejects.toThrow("boom");
  });

  it("propagates fetcher rejections (apewisdom)", async () => {
    const lookupApewisdom = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      handleMessage(
        { type: "apewisdom:lookup", ticker: "AAPL" },
        noopTicker,
        lookupApewisdom,
      ),
    ).rejects.toThrow("boom");
  });

  it("returns undefined for unknown / malformed messages", () => {
    expect(handleMessage({ type: "other" }, noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage(null, noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage("x", noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage({ type: "ticker:lookup" }, noopTicker, noopApewisdom)).toBeUndefined();
    expect(handleMessage({ type: "apewisdom:lookup", ticker: 5 }, noopTicker, noopApewisdom)).toBeUndefined();
  });
});
```

- [ ] **Step 2: run tests → FAIL (signature mismatch, new types).**

- [ ] **Step 3: Replace `src/background/messages.ts`**

```ts
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { TickerFetcher } from "../lib/ticker-cache";

export interface TickerLookupMessage {
  type: "ticker:lookup";
  isin: string;
}

export interface ApewisdomLookupMessage {
  type: "apewisdom:lookup";
  ticker: string;
}

export type ApewisdomLookup = (
  ticker: string,
) => Promise<ApewisdomEntry | null>;

function isTickerLookup(value: unknown): value is TickerLookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "ticker:lookup" &&
    typeof (value as { isin?: unknown }).isin === "string"
  );
}

function isApewisdomLookup(value: unknown): value is ApewisdomLookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "apewisdom:lookup" &&
    typeof (value as { ticker?: unknown }).ticker === "string"
  );
}

export function handleMessage(
  message: unknown,
  fetchTicker: TickerFetcher,
  lookupApewisdom: ApewisdomLookup,
): Promise<string | null> | Promise<ApewisdomEntry | null> | undefined {
  if (isTickerLookup(message)) return fetchTicker(message.isin);
  if (isApewisdomLookup(message)) return lookupApewisdom(message.ticker);
  return undefined;
}
```

- [ ] **Step 4: tests pass 5/5.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: Commit**

```
git add src/background/messages.ts src/background/messages.test.ts
git commit -m "feat(background): route apewisdom:lookup in message handler"
```

---

## Task 5: Wire Apewisdom into background entry

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Replace `src/background/index.ts`**

```ts
import { fetchApewisdomSnapshot } from "../lib/apewisdom";
import { browserStorageKvStore } from "../lib/kv-store";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { createApewisdomService } from "./apewisdom-service";
import { handleMessage } from "./messages";

const store = browserStorageKvStore(browser.storage.local);
const apewisdom = createApewisdomService(store, () =>
  fetchApewisdomSnapshot(fetch),
);

browser.runtime.onMessage.addListener((message) =>
  handleMessage(
    message,
    (isin) => fetchTickerFromOpenFigi(isin, fetch),
    (ticker) => apewisdom.lookup(ticker),
  ),
);
```

- [ ] **Step 2: typecheck + build — exit 0.** Verify the background bundle in `dist/` grew.

- [ ] **Step 3: Commit**

```
git add src/background/index.ts
git commit -m "feat(background): wire apewisdom service into message router"
```

---

## Task 6: Badge becomes a button

**Files:**
- Modify: `src/content/Badge.tsx`
- Modify: `src/content/Badge.test.tsx`
- Modify: `src/content/badge.css`

Add `onClick?: () => void`. Render as `<button>` so keyboard + screen readers get it for free. Strip native button chrome in CSS.

- [ ] **Step 1: Replace `src/content/Badge.test.tsx`**

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("<Badge />", () => {
  it("renders the ISIN", () => {
    const { getByText } = render(<Badge isin="US0378331005" />);
    expect(getByText("US0378331005")).toBeTruthy();
  });

  it("renders the brand label", () => {
    const { getByText } = render(<Badge isin="US0378331005" />);
    expect(getByText(/Ape Intel/i)).toBeTruthy();
  });

  it("renders the ticker when provided", () => {
    const { getByText } = render(<Badge isin="US0378331005" ticker="AAPL" />);
    expect(getByText("AAPL")).toBeTruthy();
  });

  it("omits the ticker element when ticker is null", () => {
    const { container } = render(<Badge isin="DE0007164600" ticker={null} />);
    expect(container.querySelector(".ape-intel-badge__ticker")).toBeNull();
  });

  it("renders as a button", () => {
    const { container } = render(<Badge isin="US0378331005" />);
    expect(container.querySelector("button.ape-intel-badge")).toBeTruthy();
  });

  it("invokes onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Badge isin="US0378331005" onClick={onClick} />,
    );
    const button = container.querySelector("button.ape-intel-badge")!;
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: run tests → 2 fail (new button + onClick cases).**

- [ ] **Step 3: Replace `src/content/Badge.tsx`**

```tsx
import "./badge.css";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
  onClick?: () => void;
}

export function Badge({ isin, ticker, onClick }: BadgeProps) {
  return (
    <button
      type="button"
      class="ape-intel-badge"
      aria-label="Open Ape Intel side panel"
      onClick={onClick}
    >
      <span class="ape-intel-badge__brand">Ape Intel</span>
      <span class="ape-intel-badge__isin">{isin}</span>
      {ticker ? (
        <span class="ape-intel-badge__ticker">{ticker}</span>
      ) : null}
    </button>
  );
}
```

(`role="status"` is removed — it conflicted with the button semantics. The button itself is the accessible affordance.)

- [ ] **Step 4: Update `src/content/badge.css`** — replace the `.ape-intel-badge` rule with:

```css
.ape-intel-badge {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: #111;
  color: #f3f3f3;
  font: 12px/1.4 system-ui, sans-serif;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  text-align: left;
}
.ape-intel-badge:hover {
  background: #1a1a1a;
}
.ape-intel-badge:focus-visible {
  outline: 2px solid #4ade80;
  outline-offset: 2px;
}
```

Keep the existing `.ape-intel-badge__brand`, `__isin`, `__ticker` rules untouched.

- [ ] **Step 5: tests pass 6/6.**
- [ ] **Step 6: typecheck + full suite — 50 tests (was 40, +4 apewisdom + 5 ttl-cache + 3 apewisdom-service + 1 messages extension - reconcile final number at run time).**
- [ ] **Step 7: Commit**

```
git add src/content/Badge.tsx src/content/Badge.test.tsx src/content/badge.css
git commit -m "feat(content): badge becomes a clickable button"
```

---

## Task 7: SidePanel component

**Files:**
- Create: `src/content/SidePanel.tsx`
- Create: `src/content/SidePanel.test.tsx`
- Create: `src/content/sidePanel.css`

Minimal panel: title (ticker or "Resolving ticker…" when undefined), Apewisdom section (mentions / sentiment / rank / 24h trend) or a "no data" message. Close button (×) calls `onClose`. Panel only renders when `isOpen`.

Trend arrow: `↑` when `mentions > mentions24hAgo`, `↓` when `<`, `→` when equal. (Not folded into Buzz/Trend computation — that's Step 4. Just a visual cue here.)

- [ ] **Step 1: Tests**

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const entry = (overrides: Partial<ApewisdomEntry> = {}): ApewisdomEntry => ({
  rank: 5,
  mentions: 247,
  mentions24hAgo: 180,
  sentimentScore: 72,
  ...overrides,
});

describe("<SidePanel />", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <SidePanel
        isOpen={false}
        ticker="AAPL"
        apewisdom={entry()}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector(".ape-intel-panel")).toBeNull();
  });

  it("renders the ticker as title when known", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry()}
        onClose={() => {}}
      />,
    );
    expect(getByText("AAPL")).toBeTruthy();
  });

  it("shows a resolving message when ticker is undefined", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker={undefined}
        apewisdom={undefined}
        onClose={() => {}}
      />,
    );
    expect(getByText(/Resolving/i)).toBeTruthy();
  });

  it("shows Apewisdom mentions, sentiment, rank and an up-arrow when trending up", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry({ mentions: 247, mentions24hAgo: 180 })}
        onClose={() => {}}
      />,
    );
    expect(getByText(/247/)).toBeTruthy();
    expect(getByText(/72/)).toBeTruthy();
    expect(getByText(/#5/)).toBeTruthy();
    expect(getByText(/↑/)).toBeTruthy();
  });

  it("shows a down-arrow when trending down", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry({ mentions: 100, mentions24hAgo: 200 })}
        onClose={() => {}}
      />,
    );
    expect(getByText(/↓/)).toBeTruthy();
  });

  it("shows a no-data message when apewisdom is null", () => {
    const { getByText } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={null}
        onClose={() => {}}
      />,
    );
    expect(getByText(/No Apewisdom data/i)).toBeTruthy();
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <SidePanel
        isOpen
        ticker="AAPL"
        apewisdom={entry()}
        onClose={onClose}
      />,
    );
    const close = container.querySelector(".ape-intel-panel__close")!;
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: run tests → FAIL.**

- [ ] **Step 3: Implement `src/content/SidePanel.tsx`**

```tsx
import "./sidePanel.css";
import type { ApewisdomEntry } from "../lib/apewisdom";

export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  onClose: () => void;
}

function trendArrow(mentions: number, mentions24hAgo: number): string {
  if (mentions > mentions24hAgo) return "↑";
  if (mentions < mentions24hAgo) return "↓";
  return "→";
}

export function SidePanel({ isOpen, ticker, apewisdom, onClose }: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside class="ape-intel-panel" aria-label="Ape Intel side panel">
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">
          {ticker ?? "Resolving ticker…"}
        </h2>
        <button
          type="button"
          class="ape-intel-panel__close"
          aria-label="Close side panel"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <section class="ape-intel-panel__section">
        <h3 class="ape-intel-panel__section-title">Apewisdom</h3>
        {apewisdom === undefined ? (
          <p class="ape-intel-panel__placeholder">Loading…</p>
        ) : apewisdom === null ? (
          <p class="ape-intel-panel__placeholder">
            No Apewisdom data — ticker not in current top 250 trending.
          </p>
        ) : (
          <dl class="ape-intel-panel__stats">
            <div>
              <dt>Mentions</dt>
              <dd>
                {apewisdom.mentions}{" "}
                <span class="ape-intel-panel__trend">
                  {trendArrow(apewisdom.mentions, apewisdom.mentions24hAgo)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Sentiment</dt>
              <dd>{apewisdom.sentimentScore} / 100</dd>
            </div>
            <div>
              <dt>Rank</dt>
              <dd>#{apewisdom.rank}</dd>
            </div>
          </dl>
        )}
      </section>
    </aside>
  );
}
```

- [ ] **Step 4: Implement `src/content/sidePanel.css`**

```css
.ape-intel-panel {
  position: fixed;
  right: 16px;
  bottom: 92px;
  z-index: 2147483646;
  width: 360px;
  max-height: 60vh;
  overflow-y: auto;
  background: #111;
  color: #f3f3f3;
  font: 13px/1.5 system-ui, sans-serif;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ape-intel-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ape-intel-panel__title {
  font: 600 16px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
  margin: 0;
}
.ape-intel-panel__close {
  background: none;
  border: none;
  color: inherit;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
}
.ape-intel-panel__close:hover {
  color: #4ade80;
}
.ape-intel-panel__section {
  border-top: 1px solid #2a2a2a;
  padding-top: 12px;
}
.ape-intel-panel__section-title {
  font: 600 11px/1 system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  margin: 0 0 8px;
}
.ape-intel-panel__placeholder {
  margin: 0;
  opacity: 0.8;
}
.ape-intel-panel__stats {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}
.ape-intel-panel__stats > div {
  display: flex;
  flex-direction: column;
}
.ape-intel-panel__stats dt {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ape-intel-panel__stats dd {
  margin: 0;
  font: 600 15px/1.2 system-ui, sans-serif;
}
.ape-intel-panel__trend {
  font-weight: 400;
  opacity: 0.7;
  margin-left: 2px;
}
```

- [ ] **Step 5: tests pass 7/7.**
- [ ] **Step 6: typecheck.**
- [ ] **Step 7: Commit**

```
git add src/content/SidePanel.tsx src/content/SidePanel.test.tsx src/content/sidePanel.css
git commit -m "feat(content): side panel with apewisdom sentiment"
```

---

## Task 8: Content-script orchestration + manifest

**Files:**
- Modify: `src/content/index.tsx`
- Modify: `manifest.config.ts`

### Behaviour
- Module-scope `isPanelOpen` boolean. Toggled by Badge `onClick`. Initial value: `false`.
- Module-scope `currentTicker` (`string | null | undefined`) and `currentApewisdom` (`ApewisdomEntry | null | undefined`) — used as render state, mutated as data resolves.
- A single `paint()` function renders Badge + SidePanel given the current state. Called whenever state changes.
- On `observeIsin` callback:
  - new ISIN: reset ticker/apewisdom to undefined, paint, kick off ticker fetch.
  - null ISIN: unmount entirely (Badge + Panel both gone).
- On ticker resolved: store, paint, if non-null kick off apewisdom fetch.
- On apewisdom resolved: store, paint.
- Generation counter still gates against stale resolves.

- [ ] **Step 1: Replace `src/content/index.tsx`**

```tsx
import { render } from "preact";
import { Badge } from "./Badge";
import { SidePanel } from "./SidePanel";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type {
  ApewisdomLookupMessage,
  TickerLookupMessage,
} from "../background/messages";

const HOST_ID = "ape-intel-host";

async function lookupTickerViaBackground(isin: string): Promise<string | null> {
  const message: TickerLookupMessage = { type: "ticker:lookup", isin };
  return (await browser.runtime.sendMessage(message)) as string | null;
}

async function lookupApewisdomViaBackground(
  ticker: string,
): Promise<ApewisdomEntry | null> {
  const message: ApewisdomLookupMessage = { type: "apewisdom:lookup", ticker };
  return (await browser.runtime.sendMessage(message)) as ApewisdomEntry | null;
}

const tickerCache = createTickerCache(
  browserStorageKvStore(browser.storage.local),
  lookupTickerViaBackground,
);

function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

function unmount(): void {
  const host = document.getElementById(HOST_ID);
  if (host) render(null, host);
}

let isPanelOpen = false;
let currentIsin: string | null = null;
let currentTicker: string | null | undefined = undefined;
let currentApewisdom: ApewisdomEntry | null | undefined = undefined;

function paint(): void {
  if (currentIsin === null) {
    unmount();
    return;
  }
  render(
    <>
      <Badge
        isin={currentIsin}
        ticker={currentTicker}
        onClick={() => {
          isPanelOpen = !isPanelOpen;
          paint();
        }}
      />
      <SidePanel
        isOpen={isPanelOpen}
        ticker={currentTicker}
        apewisdom={currentApewisdom}
        onClose={() => {
          isPanelOpen = false;
          paint();
        }}
      />
    </>,
    ensureHost(),
  );
}

let generation = 0;

observeIsin(window, (isin) => {
  generation += 1;
  const requestGeneration = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;

  if (!isin) {
    paint();
    return;
  }

  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (requestGeneration !== generation) return;
      currentTicker = ticker;
      paint();

      if (!ticker) return;
      lookupApewisdomViaBackground(ticker).then(
        (entry) => {
          if (requestGeneration !== generation) return;
          currentApewisdom = entry;
          paint();
        },
        (error) => {
          if (requestGeneration !== generation) return;
          console.warn("[ape-intel] apewisdom lookup failed", error);
          currentApewisdom = null;
          paint();
        },
      );
    },
    (error) => {
      if (requestGeneration !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", error);
      currentTicker = null;
      paint();
    },
  );
});
```

- [ ] **Step 2: Replace `manifest.config.ts`** with:

```ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ape Intel",
  version: "0.0.5",
  description:
    "Community sentiment + news panel for Scalable Capital security pages.",
  browser_specific_settings: {
    gecko: {
      id: "ape-intel@lmueller.dev",
      strict_min_version: "121.0",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
  permissions: ["storage"],
  host_permissions: [
    "https://api.openfigi.com/*",
    "https://apewisdom.io/*",
  ],
  background: {
    scripts: ["src/background/index.ts"],
  },
  content_scripts: [
    {
      matches: ["https://de.scalable.capital/broker/security*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
});
```

- [ ] **Step 3: typecheck + tests + build.**

`npm run typecheck && npm test && npm run build` — exit 0; tests still pass; `dist/manifest.json` reads v0.0.5 with both host permissions.

- [ ] **Step 4: Commit**

```
git add src/content/index.tsx manifest.config.ts
git commit -m "feat(content): side panel orchestration + apewisdom host permission, bump 0.0.5"
```

---

## Task 9: Manual Firefox verification

Interactive.

- [ ] **Step 1: Remove + Load Temporary Add-on** on `dist/manifest.json`. Version `0.0.5`. Both host permissions should appear in the Permissions section.

- [ ] **Step 2:** Open `https://de.scalable.capital/broker/security?isin=US0378331005`. Badge shows `APE INTEL / US0378331005 / AAPL` within ~1s.

- [ ] **Step 3:** Click the Badge. Side Panel appears above-right with:
  - Title: `AAPL`
  - Apewisdom section: Mentions (number with ↑/↓/→ arrow), Sentiment (0–100), Rank (#N).
  - If AAPL is in the top 250: real numbers. If not: "No Apewisdom data — ticker not in current top 250 trending."
- [ ] **Step 4:** Click × on the panel → panel closes. Click Badge again → panel reopens.
- [ ] **Step 5:** With panel open, navigate via Scalable's search to another security. Panel stays open and re-renders with the new ticker.
- [ ] **Step 6:** Navigate to a DE-only ISIN. Panel shows ticker = null path (no Apewisdom data; ticker line absent in Badge).
- [ ] **Step 7:** Background DevTools (Inspect on Ape Intel): one POST to OpenFIGI + one GET to `apewisdom.io/.../page/1..5` on first ISIN. Second ISIN reuses Apewisdom snapshot from storage (no new Apewisdom calls within 15 min).
- [ ] **Step 8:** Storage inspector → `apewisdom:snapshot` key with `{value: {entries: [...]}, fetchedAt: <ts>}`.
- [ ] **Step 9:** Tag

```bash
git tag -a v0.0.5-apewisdom -m "Step 3: apewisdom adapter + side panel"
```

---

## Done criteria

- All tests pass (target ~57: 40 prior + 4 apewisdom + 5 ttl-cache + 3 apewisdom-service + 5 messages + 6 Badge + 7 SidePanel - 7 old SidePanel? Recount at run time).
- typecheck + build exit 0.
- Firefox: click Badge → panel opens with Apewisdom data; persists across SPA nav; closes; works for trending tickers and shows "no data" for non-trending.
- Tag `v0.0.5-apewisdom` on `main`.

## Deferred to later steps

- Tradestie + StockTwits adapters and fused Barometer → Step 4.
- News + Earnings → Step 5.
- Per-source breakdown UI / Coverage states copy → Step 4 (breakdown) / Step 8 (copy).
- Manual Refresh button + cooldown → Step 8.
- Favourites star → Step 6.

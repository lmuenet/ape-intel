# Finnhub News + Earnings (Step 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Top-5 (last 7 days) News section with light catalyst tags and a next-Earnings-Date row to the Side Panel, sourced from Finnhub, with a minimal inline API-key field.

**Architecture:** Follows the existing adapter pattern — `src/lib/finnhub.ts` (pure fetch, injected `FetchFn`/`apiKey`/`now`) + `src/lib/catalyst.ts` (pure classifier) → `src/background/finnhub-service.ts` (TtlCache, reads key from store, gates on key) → `messages.ts` + `background/index.ts` → `content/index.tsx` (key gate + dispatch + state) → `src/content/NewsSection.tsx` UI. Tradestie/Alpha-Vantage untouched.

**Tech Stack:** TypeScript, Preact, Vitest, `@testing-library/preact`. Runner: `npm test`; single file: `npx vitest run <path>`.

**Design doc:** `docs/superpowers/specs/2026-05-29-finnhub-news-earnings-design.md`.

---

### Task 1: Catalyst classifier

**Files:**
- Create: `src/lib/catalyst.ts`
- Test: `src/lib/catalyst.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/catalyst.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyCatalyst, CATALYST_LABEL } from "./catalyst";

describe("classifyCatalyst", () => {
  it("tags earnings headlines", () => {
    expect(classifyCatalyst("Apple posts Q2 earnings beat")).toBe("earnings");
  });
  it("tags M&A headlines", () => {
    expect(classifyCatalyst("Broadcom to acquire VMware")).toBe("m&a");
  });
  it("tags guidance headlines", () => {
    expect(classifyCatalyst("Ford cuts full-year outlook")).toBe("guidance");
  });
  it("tags analyst headlines", () => {
    expect(classifyCatalyst("Goldman initiates Tesla with Buy rating")).toBe("analyst");
  });
  it("tags regulatory headlines", () => {
    expect(classifyCatalyst("FDA approval for Pfizer drug")).toBe("regulatory");
  });
  it("tags product headlines", () => {
    expect(classifyCatalyst("Apple unveils new iPhone")).toBe("product");
  });
  it("falls back to news", () => {
    expect(classifyCatalyst("CEO discusses company strategy at conference")).toBe("news");
  });
  it("checks earnings before guidance", () => {
    expect(classifyCatalyst("Acme earnings beat as it raises guidance")).toBe("earnings");
  });
  it("exposes a display label for every tag", () => {
    expect(CATALYST_LABEL["m&a"]).toBe("M&A");
    expect(CATALYST_LABEL.news).toBe("News");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/catalyst.test.ts`
Expected: FAIL — cannot find module `./catalyst`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/catalyst.ts`:

```ts
export type CatalystTag =
  | "earnings" | "m&a" | "guidance" | "analyst" | "regulatory" | "product" | "news";

// Ordered: first match wins. earnings before guidance; m&a before product.
const RULES: Array<{ tag: CatalystTag; pattern: RegExp }> = [
  { tag: "earnings", pattern: /\b(earnings|eps|quarterly results|q[1-4]\b|beats?|misses?|revenue)\b/i },
  { tag: "m&a", pattern: /\b(acquir\w*|merger|buyout|takeover|acquisition|stake)\b/i },
  { tag: "guidance", pattern: /\b(guidance|outlook|forecast|raises|cuts|lowers)\b/i },
  { tag: "analyst", pattern: /\b(upgrades?|downgrades?|price target|initiates|rating)\b/i },
  { tag: "regulatory", pattern: /\b(fda|approval|lawsuit|sec|investigation|antitrust|probe|recall)\b/i },
  { tag: "product", pattern: /\b(launch\w*|unveils?|releases?|product)\b/i },
];

export function classifyCatalyst(headline: string): CatalystTag {
  for (const { tag, pattern } of RULES) {
    if (pattern.test(headline)) return tag;
  }
  return "news";
}

export const CATALYST_LABEL: Record<CatalystTag, string> = {
  earnings: "Earnings",
  "m&a": "M&A",
  guidance: "Guidance",
  analyst: "Analyst",
  regulatory: "Regulatory",
  product: "Product",
  news: "News",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/catalyst.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalyst.ts src/lib/catalyst.test.ts
git commit -m "feat(catalyst): light keyword headline classifier"
```

---

### Task 2: Finnhub company-news fetch

**Files:**
- Create: `src/lib/finnhub.ts`
- Test: `src/lib/finnhub.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/finnhub.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchCompanyNews } from "./finnhub";

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const NOW = Date.parse("2026-05-29T12:00:00Z"); // to=2026-05-29, from=2026-05-22

describe("fetchCompanyNews", () => {
  it("requests company-news with token and a 7-day window", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([]));
    await fetchCompanyNews("AAPL", "KEY", fetchFn, NOW);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://finnhub.io/api/v1/company-news?symbol=AAPL&from=2026-05-22&to=2026-05-29&token=KEY",
    );
  });

  it("maps, sorts by datetime desc, caps at 5, and tags catalysts", async () => {
    const raw = [
      { headline: "Old news", source: "S", url: "u1", datetime: 100 },
      { headline: "Apple posts Q2 earnings beat", source: "Reuters", url: "u2", datetime: 300 },
      { headline: "Broadcom to acquire VMware", source: "WSJ", url: "u3", datetime: 200 },
      { headline: "A", source: "S", url: "u4", datetime: 400 },
      { headline: "B", source: "S", url: "u5", datetime: 350 },
      { headline: "C", source: "S", url: "u6", datetime: 250 },
    ];
    const result = await fetchCompanyNews("AAPL", "KEY", vi.fn().mockResolvedValue(ok(raw)), NOW);
    expect(result).toHaveLength(5);
    expect(result[0].datetime).toBe(400);
    expect(result.map((r) => r.url)).not.toContain("u1");
    expect(result.find((r) => r.url === "u2")!.catalyst).toBe("earnings");
    expect(result.find((r) => r.url === "u3")!.catalyst).toBe("m&a");
  });

  it("drops entries missing headline or url", async () => {
    const raw = [
      { source: "S", url: "u1", datetime: 100 },
      { headline: "Has no url", source: "S", datetime: 200 },
      { headline: "Good one", source: "S", url: "u3", datetime: 300 },
    ];
    const result = await fetchCompanyNews("AAPL", "KEY", vi.fn().mockResolvedValue(ok(raw)), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe("Good one");
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(fetchCompanyNews("AAPL", "BAD", fetchFn, NOW)).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finnhub.test.ts`
Expected: FAIL — cannot find module `./finnhub`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/finnhub.ts`:

```ts
import { classifyCatalyst, type CatalystTag } from "./catalyst";

const NEWS_ENDPOINT = "https://finnhub.io/api/v1/company-news";

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number;
  catalyst: CatalystTag;
}

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface RawNews {
  headline?: string;
  source?: string;
  url?: string;
  datetime?: number;
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function fetchCompanyNews(
  ticker: string,
  apiKey: string,
  fetchFn: FetchFn,
  now: number = Date.now(),
): Promise<NewsItem[]> {
  const to = ymd(now);
  const from = ymd(now - 7 * 24 * 60 * 60 * 1000);
  const url =
    `${NEWS_ENDPOINT}?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}` +
    `&token=${encodeURIComponent(apiKey)}`;

  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Finnhub news returned ${response.status}`);

  const body = (await response.json()) as RawNews[];
  if (!Array.isArray(body)) return [];

  const items: NewsItem[] = [];
  for (const r of body) {
    if (typeof r.headline !== "string" || r.headline.length === 0) continue;
    if (typeof r.url !== "string" || r.url.length === 0) continue;
    items.push({
      headline: r.headline,
      source: r.source ?? "",
      url: r.url,
      datetime: r.datetime ?? 0,
      catalyst: classifyCatalyst(r.headline),
    });
  }
  items.sort((a, b) => b.datetime - a.datetime);
  return items.slice(0, 5);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finnhub.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finnhub.ts src/lib/finnhub.test.ts
git commit -m "feat(finnhub): company-news fetch with 7-day window + catalyst tags"
```

---

### Task 3: Finnhub next-earnings fetch

**Files:**
- Modify: `src/lib/finnhub.ts`
- Test: `src/lib/finnhub.test.ts`

- [ ] **Step 1: Write the failing test** — APPEND to `src/lib/finnhub.test.ts`:

```ts
import { fetchNextEarnings } from "./finnhub";

describe("fetchNextEarnings", () => {
  it("requests the earnings calendar with token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ earningsCalendar: [] }));
    await fetchNextEarnings("AAPL", "KEY", fetchFn, NOW);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://finnhub.io/api/v1/calendar/earnings?symbol=AAPL&token=KEY",
    );
  });

  it("returns the earliest upcoming date with its eps estimate", async () => {
    const body = { earningsCalendar: [
      { date: "2026-05-10", epsEstimate: 1.0 },
      { date: "2026-08-01", epsEstimate: 2.5 },
      { date: "2026-06-15", epsEstimate: 2.1 },
    ] };
    const result = await fetchNextEarnings("AAPL", "KEY", vi.fn().mockResolvedValue(ok(body)), NOW);
    expect(result).toEqual({ date: "2026-06-15", epsEstimate: 2.1 });
  });

  it("returns null when there is no upcoming earnings date", async () => {
    const body = { earningsCalendar: [{ date: "2026-01-01", epsEstimate: 1.0 }] };
    expect(await fetchNextEarnings("AAPL", "KEY", vi.fn().mockResolvedValue(ok(body)), NOW)).toBeNull();
  });

  it("defaults a missing eps estimate to null", async () => {
    const body = { earningsCalendar: [{ date: "2026-07-01" }] };
    expect(await fetchNextEarnings("AAPL", "KEY", vi.fn().mockResolvedValue(ok(body)), NOW))
      .toEqual({ date: "2026-07-01", epsEstimate: null });
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("x", { status: 500 }));
    await expect(fetchNextEarnings("AAPL", "K", fetchFn, NOW)).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finnhub.test.ts`
Expected: FAIL — `fetchNextEarnings` not exported.

- [ ] **Step 3: Write minimal implementation** — APPEND to `src/lib/finnhub.ts`:

```ts
const EARNINGS_ENDPOINT = "https://finnhub.io/api/v1/calendar/earnings";

export interface EarningsDate {
  date: string;
  epsEstimate: number | null;
}

interface RawEarnings {
  date?: string;
  epsEstimate?: number | null;
}

interface EarningsResponse {
  earningsCalendar?: RawEarnings[];
}

export async function fetchNextEarnings(
  ticker: string,
  apiKey: string,
  fetchFn: FetchFn,
  now: number = Date.now(),
): Promise<EarningsDate | null> {
  const url =
    `${EARNINGS_ENDPOINT}?symbol=${encodeURIComponent(ticker)}` +
    `&token=${encodeURIComponent(apiKey)}`;

  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Finnhub earnings returned ${response.status}`);

  const body = (await response.json()) as EarningsResponse;
  const today = ymd(now);
  const upcoming = (body.earningsCalendar ?? [])
    .filter((e): e is RawEarnings & { date: string } =>
      typeof e.date === "string" && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const next = upcoming[0];
  if (!next) return null;
  return { date: next.date, epsEstimate: next.epsEstimate ?? null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finnhub.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finnhub.ts src/lib/finnhub.test.ts
git commit -m "feat(finnhub): next-earnings-date fetch with consensus EPS"
```

---

### Task 4: Finnhub background service

**Files:**
- Create: `src/background/finnhub-service.ts`
- Test: `src/background/finnhub-service.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/background/finnhub-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { NewsItem } from "../lib/finnhub";
import { createFinnhubService } from "./finnhub-service";

const newsItem = (url: string): NewsItem => ({
  headline: "h", source: "s", url, datetime: 1, catalyst: "news",
});

describe("createFinnhubService", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns null without calling fetchers when no api key is stored", async () => {
    const newsFetcher = vi.fn();
    const earningsFetcher = vi.fn();
    const service = createFinnhubService(createInMemoryKvStore(), newsFetcher, earningsFetcher);
    expect(await service.news("AAPL")).toBeNull();
    expect(await service.earnings("AAPL")).toBeNull();
    expect(newsFetcher).not.toHaveBeenCalled();
    expect(earningsFetcher).not.toHaveBeenCalled();
  });

  it("passes the stored key to the news fetcher and caches within ttl", async () => {
    const store = createInMemoryKvStore({ "finnhub:apiKey": "KEY" });
    const newsFetcher = vi.fn(async () => [newsItem("u1")]);
    const service = createFinnhubService(store, newsFetcher, vi.fn());
    expect(await service.news("AAPL")).toEqual([newsItem("u1")]);
    await service.news("AAPL");
    expect(newsFetcher).toHaveBeenCalledTimes(1);
    expect(newsFetcher).toHaveBeenCalledWith("AAPL", "KEY");
  });

  it("caches earnings separately per ticker", async () => {
    const store = createInMemoryKvStore({ "finnhub:apiKey": "KEY" });
    const earningsFetcher = vi.fn(async () => ({ date: "2026-02-01", epsEstimate: 1 }));
    const service = createFinnhubService(store, vi.fn(), earningsFetcher);
    await service.earnings("AAPL");
    await service.earnings("TSLA");
    expect(earningsFetcher).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/finnhub-service.test.ts`
Expected: FAIL — cannot find module `./finnhub-service`.

- [ ] **Step 3: Write minimal implementation** — create `src/background/finnhub-service.ts`:

```ts
import type { KvStore } from "../lib/kv-store";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import { createTtlCache } from "../lib/ttl-cache";

const NEWS_TTL_MS = 30 * 60 * 1000;
const EARNINGS_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_NAME = "finnhub:apiKey";

export type NewsFetcher = (ticker: string, apiKey: string) => Promise<NewsItem[]>;
export type EarningsFetcher = (ticker: string, apiKey: string) => Promise<EarningsDate | null>;

export interface FinnhubService {
  news(ticker: string): Promise<NewsItem[] | null>;
  earnings(ticker: string): Promise<EarningsDate | null>;
}

export function createFinnhubService(
  store: KvStore,
  newsFetcher: NewsFetcher,
  earningsFetcher: EarningsFetcher,
): FinnhubService {
  const newsCache = createTtlCache<NewsItem[] | null>(
    store,
    async (ticker) => {
      const key = await store.get<string>(KEY_NAME);
      if (!key) return null;
      return newsFetcher(ticker, key);
    },
    { ttlMs: NEWS_TTL_MS, keyPrefix: "finnhub-news" },
  );

  const earningsCache = createTtlCache<EarningsDate | null>(
    store,
    async (ticker) => {
      const key = await store.get<string>(KEY_NAME);
      if (!key) return null;
      return earningsFetcher(ticker, key);
    },
    { ttlMs: EARNINGS_TTL_MS, keyPrefix: "finnhub-earnings" },
  );

  return {
    // Gate on the key BEFORE the cache so a missing key is never cached
    // (otherwise a null would be served for the whole TTL after the key is added).
    async news(ticker: string): Promise<NewsItem[] | null> {
      if (!(await store.get<string>(KEY_NAME))) return null;
      return newsCache.get(ticker);
    },
    async earnings(ticker: string): Promise<EarningsDate | null> {
      if (!(await store.get<string>(KEY_NAME))) return null;
      return earningsCache.get(ticker);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/background/finnhub-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/finnhub-service.ts src/background/finnhub-service.test.ts
git commit -m "feat(finnhub-service): TTL-cached news/earnings gated on stored key"
```

---

### Task 5: Message routing + background wiring

**Files:**
- Modify: `src/background/messages.ts`
- Modify: `src/background/messages.test.ts`
- Modify: `src/background/index.ts`

- [ ] **Step 1: Write the failing test** — in `src/background/messages.test.ts`:

(a) Add imports at the top (after the existing type imports):
```ts
import type { NewsItem, EarningsDate } from "../lib/finnhub";
```
(b) Replace the `handlers` factory's object body to include the two new handlers:
```ts
const handlers = (
  overrides: Partial<MessageHandlers> = {},
): MessageHandlers => ({
  fetchTicker: vi.fn(),
  lookupApewisdom: vi.fn(),
  lookupTradestie: vi.fn(),
  lookupStockTwits: vi.fn(),
  lookupFinnhubNews: vi.fn(),
  lookupFinnhubEarnings: vi.fn(),
  ...overrides,
});
```
(c) Append two routing tests inside the `describe("handleMessage", ...)` block, before its closing `});`:
```ts
  it("routes finnhub:news", async () => {
    const items: NewsItem[] = [{ headline: "h", source: "s", url: "u", datetime: 1, catalyst: "news" }];
    const lookupFinnhubNews = vi.fn().mockResolvedValue(items);
    await expect(
      handleMessage({ type: "finnhub:news", ticker: "AAPL" }, handlers({ lookupFinnhubNews })),
    ).resolves.toBe(items);
    expect(lookupFinnhubNews).toHaveBeenCalledWith("AAPL");
  });

  it("routes finnhub:earnings", async () => {
    const date: EarningsDate = { date: "2026-06-15", epsEstimate: 2.1 };
    const lookupFinnhubEarnings = vi.fn().mockResolvedValue(date);
    await expect(
      handleMessage({ type: "finnhub:earnings", ticker: "AAPL" }, handlers({ lookupFinnhubEarnings })),
    ).resolves.toBe(date);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/messages.test.ts`
Expected: FAIL — `lookupFinnhubNews`/`lookupFinnhubEarnings` not on `MessageHandlers`; routes return undefined.

- [ ] **Step 3: Write minimal implementation** — in `src/background/messages.ts`:

(a) Add a type import after the existing `import type { TradestieEntry }` line:
```ts
import type { NewsItem, EarningsDate } from "../lib/finnhub";
```
(b) Add the two message interfaces after `StockTwitsLookupMessage`:
```ts
export interface FinnhubNewsLookupMessage { type: "finnhub:news"; ticker: string }
export interface FinnhubEarningsLookupMessage { type: "finnhub:earnings"; ticker: string }
```
(c) Add the two handler types after `StockTwitsLookup`:
```ts
export type FinnhubNewsLookup = (ticker: string) => Promise<NewsItem[] | null>;
export type FinnhubEarningsLookup = (ticker: string) => Promise<EarningsDate | null>;
```
(d) Add the two fields to `MessageHandlers`:
```ts
export interface MessageHandlers {
  fetchTicker: TickerFetcher;
  lookupApewisdom: ApewisdomLookup;
  lookupTradestie: TradestieLookup;
  lookupStockTwits: StockTwitsLookup;
  lookupFinnhubNews: FinnhubNewsLookup;
  lookupFinnhubEarnings: FinnhubEarningsLookup;
}
```
(e) Extend the `handleMessage` return-type union with two more members (add to the existing union):
```ts
  | Promise<NewsItem[] | null>
  | Promise<EarningsDate | null>
```
(f) Add two routing branches before the final `return undefined;`:
```ts
  if (isTypedTickerMessage(message, "finnhub:news")) return handlers.lookupFinnhubNews(message.ticker);
  if (isTypedTickerMessage(message, "finnhub:earnings")) return handlers.lookupFinnhubEarnings(message.ticker);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/background/messages.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Wire the service in `src/background/index.ts`** — replace the whole file with:

```ts
import { fetchApewisdomSnapshot } from "../lib/apewisdom";
import { fetchCompanyNews, fetchNextEarnings } from "../lib/finnhub";
import { browserStorageKvStore } from "../lib/kv-store";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { fetchStockTwitsForTicker } from "../lib/stocktwits";
import { fetchTradestieSnapshot } from "../lib/tradestie";
import { createApewisdomService } from "./apewisdom-service";
import { createFinnhubService } from "./finnhub-service";
import { createStockTwitsService } from "./stocktwits-service";
import { createTradestieService } from "./tradestie-service";
import { handleMessage } from "./messages";

const store = browserStorageKvStore(browser.storage.local);
const apewisdom = createApewisdomService(store, () => fetchApewisdomSnapshot(fetch));
const tradestie = createTradestieService(store, () => fetchTradestieSnapshot(fetch));
const stocktwits = createStockTwitsService(store, (ticker) => fetchStockTwitsForTicker(ticker, fetch));
const finnhub = createFinnhubService(
  store,
  (ticker, key) => fetchCompanyNews(ticker, key, fetch),
  (ticker, key) => fetchNextEarnings(ticker, key, fetch),
);

browser.runtime.onMessage.addListener((message) =>
  handleMessage(message, {
    fetchTicker: (isin) => fetchTickerFromOpenFigi(isin, fetch),
    lookupApewisdom: (ticker) => apewisdom.lookup(ticker),
    lookupTradestie: (ticker) => tradestie.lookup(ticker),
    lookupStockTwits: (ticker) => stocktwits.lookup(ticker),
    lookupFinnhubNews: (ticker) => finnhub.news(ticker),
    lookupFinnhubEarnings: (ticker) => finnhub.earnings(ticker),
  }),
);
```

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/background/messages.ts src/background/messages.test.ts src/background/index.ts
git commit -m "feat(messages): route finnhub:news/earnings + wire service in background"
```

---

### Task 6: News + Earnings UI components

**Files:**
- Create: `src/content/NewsSection.tsx`
- Modify: `src/content/sidePanel.css`
- Test: `src/content/NewsSection.test.tsx`

- [ ] **Step 1: Write the failing test** — create `src/content/NewsSection.test.tsx`:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "../lib/finnhub";
import { NewsSection, EarningsRow } from "./NewsSection";

afterEach(cleanup);

const item = (o: Partial<NewsItem> = {}): NewsItem => ({
  headline: "Acme posts record quarter",
  source: "Reuters",
  url: "https://example.com/a",
  datetime: 1747699200, // 2025-05-20T00:00:00Z
  catalyst: "earnings",
  ...o,
});

describe("<NewsSection />", () => {
  it("shows a key input form when there is no key", () => {
    const onSaveKey = vi.fn();
    const { getByPlaceholderText, getByText } = render(
      <NewsSection hasKey={false} news={undefined} onSaveKey={onSaveKey} />,
    );
    const input = getByPlaceholderText("Finnhub API key") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "  abc123  " } });
    fireEvent.click(getByText("Save"));
    expect(onSaveKey).toHaveBeenCalledWith("abc123");
  });

  it("shows Loading when key present and news is undefined", () => {
    const { getByText } = render(<NewsSection hasKey news={undefined} onSaveKey={vi.fn()} />);
    expect(getByText(/Loading/i)).toBeTruthy();
  });

  it("shows an error message when news is null", () => {
    const { getByText } = render(<NewsSection hasKey news={null} onSaveKey={vi.fn()} />);
    expect(getByText(/Couldn't load news/i)).toBeTruthy();
  });

  it("shows an empty message when there is no news", () => {
    const { getByText } = render(<NewsSection hasKey news={[]} onSaveKey={vi.fn()} />);
    expect(getByText(/No news in the last 7 days/i)).toBeTruthy();
  });

  it("renders headlines as links with a catalyst tag and date", () => {
    const { getByText, container } = render(
      <NewsSection hasKey news={[item()]} onSaveKey={vi.fn()} />,
    );
    const link = getByText("Acme posts record quarter") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://example.com/a");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(getByText("Earnings")).toBeTruthy();
    expect(getByText("2025-05-20")).toBeTruthy();
    expect(container.querySelector(".ape-intel-news__tag")).toBeTruthy();
  });
});

describe("<EarningsRow />", () => {
  it("shows Loading when undefined", () => {
    const { getByText } = render(<EarningsRow earnings={undefined} />);
    expect(getByText(/Loading/i)).toBeTruthy();
  });
  it("shows a no-date message when null", () => {
    const { getByText } = render(<EarningsRow earnings={null} />);
    expect(getByText(/No upcoming earnings/i)).toBeTruthy();
  });
  it("shows the date and EPS estimate when present", () => {
    const { getByText } = render(<EarningsRow earnings={{ date: "2026-06-15", epsEstimate: 2.1 }} />);
    expect(getByText(/2026-06-15/)).toBeTruthy();
    expect(getByText(/EPS est\. 2\.1/)).toBeTruthy();
  });
  it("omits the EPS estimate when null", () => {
    const { container, getByText } = render(<EarningsRow earnings={{ date: "2026-07-01", epsEstimate: null }} />);
    expect(getByText(/2026-07-01/)).toBeTruthy();
    expect(container.querySelector(".ape-intel-earnings__eps")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/NewsSection.test.tsx`
Expected: FAIL — cannot find module `./NewsSection`.

- [ ] **Step 3: Write minimal implementation** — create `src/content/NewsSection.tsx`:

```tsx
import { CATALYST_LABEL } from "../lib/catalyst";
import type { EarningsDate, NewsItem } from "../lib/finnhub";

export interface NewsSectionProps {
  hasKey: boolean;
  news: NewsItem[] | null | undefined;
  onSaveKey: (key: string) => void;
}

export interface EarningsRowProps {
  earnings: EarningsDate | null | undefined;
}

function newsDate(datetime: number): string {
  return new Date(datetime * 1000).toISOString().slice(0, 10);
}

function KeyForm({ onSaveKey }: { onSaveKey: (key: string) => void }) {
  const onSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem("finnhubKey") as HTMLInputElement | null;
    const value = input?.value.trim() ?? "";
    if (value) onSaveKey(value);
  };
  return (
    <form class="ape-intel-news__keyform" onSubmit={onSubmit}>
      <input type="text" name="finnhubKey" placeholder="Finnhub API key" class="ape-intel-news__keyinput" />
      <button type="submit" class="ape-intel-news__keysave">Save</button>
    </form>
  );
}

export function NewsSection({ hasKey, news, onSaveKey }: NewsSectionProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-news">
      <h3 class="ape-intel-panel__section-title">News</h3>
      {!hasKey ? <KeyForm onSaveKey={onSaveKey} />
      : news === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : news === null ? <p class="ape-intel-panel__placeholder">Couldn't load news.</p>
      : news.length === 0 ? <p class="ape-intel-panel__placeholder">No news in the last 7 days.</p>
      : (
        <ul class="ape-intel-news__list">
          {news.map((it) => (
            <li class="ape-intel-news__item" key={it.url}>
              <a class="ape-intel-news__headline" href={it.url} target="_blank" rel="noopener noreferrer">
                {it.headline}
              </a>
              <div class="ape-intel-news__meta">
                <span class="ape-intel-news__tag" data-catalyst={it.catalyst}>{CATALYST_LABEL[it.catalyst]}</span>
                {it.source ? <span class="ape-intel-news__source">{it.source}</span> : null}
                <span class="ape-intel-news__date">{newsDate(it.datetime)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EarningsRow({ earnings }: EarningsRowProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-earnings">
      <h3 class="ape-intel-panel__section-title">Next earnings</h3>
      {earnings === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : earnings === null ? <p class="ape-intel-panel__placeholder">No upcoming earnings date.</p>
      : (
        <p class="ape-intel-earnings__value">
          {earnings.date}
          {earnings.epsEstimate !== null
            ? <span class="ape-intel-earnings__eps"> · EPS est. {earnings.epsEstimate}</span>
            : null}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Append CSS to `src/content/sidePanel.css`:**

```css
.ape-intel-earnings__value { margin: 0; font: 600 15px/1.3 system-ui, sans-serif; }
.ape-intel-earnings__eps { font-weight: 400; opacity: 0.7; }

.ape-intel-news__keyform { display: flex; gap: 8px; }
.ape-intel-news__keyinput {
  flex: 1; min-width: 0; padding: 6px 8px; border-radius: 6px;
  border: 1px solid #2a2a2a; background: #1a1a1a; color: inherit; font-size: 12px;
}
.ape-intel-news__keysave {
  padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
  background: #4ade80; color: #111; font-weight: 600; font-size: 12px;
}
.ape-intel-news__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ape-intel-news__item { display: flex; flex-direction: column; gap: 4px; }
.ape-intel-news__headline { color: inherit; text-decoration: none; font-weight: 500; line-height: 1.3; }
.ape-intel-news__headline:hover { color: #4ade80; }
.ape-intel-news__meta { display: flex; gap: 8px; align-items: center; font-size: 11px; opacity: 0.7; }
.ape-intel-news__tag {
  text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
  font-size: 10px; padding: 1px 6px; border-radius: 4px; background: #232323; opacity: 1;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/content/NewsSection.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/NewsSection.tsx src/content/NewsSection.test.tsx src/content/sidePanel.css
git commit -m "feat(content): NewsSection (Top-5 + catalyst tags + key form) and EarningsRow"
```

---

### Task 7: Integrate News + Earnings into the Side Panel

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Test: `src/content/SidePanel.test.tsx`

- [ ] **Step 1: Write the failing test** — in `src/content/SidePanel.test.tsx`:

(a) Add imports near the top:
```ts
import type { NewsItem, EarningsDate } from "../lib/finnhub";
```
(b) Add fixtures + four fields to the `defaults` object. Insert these `const`s above `const defaults`:
```ts
const sampleNews: NewsItem[] = [
  { headline: "Acme posts record quarter", source: "Reuters", url: "https://example.com/a", datetime: 1747699200, catalyst: "earnings" },
];
const sampleEarnings: EarningsDate = { date: "2026-06-02", epsEstimate: 2.15 };
```
and add these four properties inside the `defaults` object literal (after `aggregate`):
```ts
  news: sampleNews as NewsItem[] | null | undefined,
  earnings: sampleEarnings as EarningsDate | null | undefined,
  finnhubKey: "fk-test" as string | null | undefined,
  onSaveKey: (_key: string) => {},
```
(c) Append these tests inside the `describe("<SidePanel />", ...)` block:
```ts
  it("renders the next-earnings row when a key is present", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText(/2026-06-02/)).toBeTruthy();
    expect(getByText(/EPS est\. 2\.15/)).toBeTruthy();
  });

  it("renders the news headline as a link", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText("Acme posts record quarter")).toBeTruthy();
  });

  it("shows the key input and hides the earnings row when no key", () => {
    const { getByPlaceholderText, queryByText } = render(
      <SidePanel {...defaults} finnhubKey={null} />,
    );
    expect(getByPlaceholderText("Finnhub API key")).toBeTruthy();
    expect(queryByText(/Next earnings/i)).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `news`/`earnings`/`finnhubKey`/`onSaveKey` not props; sections not rendered.

- [ ] **Step 3: Write minimal implementation** — in `src/content/SidePanel.tsx`:

(a) Add imports after the existing barometer imports:
```tsx
import { NewsSection, EarningsRow } from "./NewsSection";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
```
(b) Add four fields to `SidePanelProps` (after `stocktwits`):
```tsx
  news: NewsItem[] | null | undefined;
  earnings: EarningsDate | null | undefined;
  finnhubKey: string | null | undefined;
  onSaveKey: (key: string) => void;
```
(c) Update the `SidePanel` function signature and body. Change the destructured params to include the new fields, and render `EarningsRow` (only when a key exists) + `NewsSection` after `ApewisdomSection`, before `ExternalLinksBar`:
```tsx
export function SidePanel({
  isOpen, ticker, aggregate, apewisdom, stocktwits,
  news, earnings, finnhubKey, onSaveKey,
  onClose, onTradingViewClick,
}: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside class="ape-intel-panel" aria-label="Ape Intel side panel">
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">{ticker ?? "Resolving ticker…"}</h2>
        <button type="button" class="ape-intel-panel__close" aria-label="Close side panel" onClick={onClose}>×</button>
      </header>
      <BarometerSection aggregate={aggregate} />
      <StockTwitsSection entry={stocktwits} />
      <ApewisdomSection entry={apewisdom} />
      {finnhubKey ? <EarningsRow earnings={earnings} /> : null}
      <NewsSection hasKey={!!finnhubKey} news={news} onSaveKey={onSaveKey} />
      <ExternalLinksBar ticker={ticker} onTradingViewClick={onTradingViewClick} />
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/content/SidePanel.tsx src/content/SidePanel.test.tsx
git commit -m "feat(side-panel): render Earnings row + News section"
```

---

### Task 8: Content wiring + manifest permission

**Files:**
- Modify: `src/content/index.tsx`
- Modify: `manifest.config.ts`

> No unit test (orchestration layer); verified via typecheck + test + build + manual load.

- [ ] **Step 1: Replace the ENTIRE contents of `src/content/index.tsx` with:**

```tsx
import { render } from "preact";
import { Badge } from "./Badge";
import { ChartOverlay } from "./ChartOverlay";
import { SidePanel } from "./SidePanel";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { aggregate as computeAggregate } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import type {
  ApewisdomLookupMessage,
  FinnhubEarningsLookupMessage,
  FinnhubNewsLookupMessage,
  StockTwitsLookupMessage,
  TickerLookupMessage,
} from "../background/messages";

const HOST_ID = "ape-intel-host";
const FINNHUB_KEY = "finnhub:apiKey";

async function send<T>(message: unknown): Promise<T> {
  return (await browser.runtime.sendMessage(message)) as T;
}

const store = browserStorageKvStore(browser.storage.local);
const tickerCache = createTickerCache(
  store,
  (isin) => send<string | null>({ type: "ticker:lookup", isin } satisfies TickerLookupMessage),
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
let isChartOpen = false;
let currentIsin: string | null = null;
let currentTicker: string | null | undefined = undefined;
let currentApewisdom: ApewisdomEntry | null | undefined = undefined;
let currentStockTwits: StockTwitsEntry | null | undefined = undefined;
let currentNews: NewsItem[] | null | undefined = undefined;
let currentEarnings: EarningsDate | null | undefined = undefined;
let finnhubKey: string | null | undefined = undefined;

// undefined while either sentiment/volume source is still loading; otherwise a
// computed Aggregate (uncovered assets yield an "unavailable" barometer, not null).
function currentAggregate(): Aggregate | undefined {
  if (currentStockTwits === undefined || currentApewisdom === undefined) return undefined;
  return computeAggregate({ stocktwits: currentStockTwits, apewisdom: currentApewisdom });
}

let generation = 0;

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
        aggregate={currentAggregate()}
        onClick={() => { isPanelOpen = !isPanelOpen; paint(); }}
      />
      <SidePanel
        isOpen={isPanelOpen}
        ticker={currentTicker}
        aggregate={currentAggregate()}
        apewisdom={currentApewisdom}
        stocktwits={currentStockTwits}
        news={currentNews}
        earnings={currentEarnings}
        finnhubKey={finnhubKey}
        onSaveKey={onSaveKey}
        onClose={() => { isPanelOpen = false; paint(); }}
        onTradingViewClick={() => { isChartOpen = true; paint(); }}
      />
      <ChartOverlay
        isOpen={isChartOpen}
        ticker={currentTicker}
        onClose={() => { isChartOpen = false; paint(); }}
      />
    </>,
    ensureHost(),
  );
}

function dispatchSentimentLookups(ticker: string, gen: number): void {
  send<ApewisdomEntry | null>({ type: "apewisdom:lookup", ticker } satisfies ApewisdomLookupMessage).then(
    (entry) => { if (gen === generation) { currentApewisdom = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] apewisdom lookup failed", e); currentApewisdom = null; paint(); } },
  );
  send<StockTwitsEntry | null>({ type: "stocktwits:lookup", ticker } satisfies StockTwitsLookupMessage).then(
    (entry) => { if (gen === generation) { currentStockTwits = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] stocktwits lookup failed", e); currentStockTwits = null; paint(); } },
  );
}

function dispatchFinnhubLookups(ticker: string, gen: number): void {
  currentNews = undefined;
  currentEarnings = undefined;
  paint();
  send<NewsItem[] | null>({ type: "finnhub:news", ticker } satisfies FinnhubNewsLookupMessage).then(
    (items) => { if (gen === generation) { currentNews = items; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] finnhub news lookup failed", e); currentNews = null; paint(); } },
  );
  send<EarningsDate | null>({ type: "finnhub:earnings", ticker } satisfies FinnhubEarningsLookupMessage).then(
    (date) => { if (gen === generation) { currentEarnings = date; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] finnhub earnings lookup failed", e); currentEarnings = null; paint(); } },
  );
}

function onSaveKey(key: string): void {
  const gen = generation;
  store.set(FINNHUB_KEY, key).then(() => {
    if (gen !== generation) return;
    finnhubKey = key;
    paint();
    if (typeof currentTicker === "string") dispatchFinnhubLookups(currentTicker, gen);
  });
}

observeIsin(window, (isin) => {
  generation += 1;
  const gen = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;
  currentStockTwits = undefined;
  currentNews = undefined;
  currentEarnings = undefined;
  finnhubKey = undefined;
  isChartOpen = false; // close chart on navigation

  if (!isin) { paint(); return; }
  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (gen !== generation) return;
      currentTicker = ticker;
      paint();

      store.get<string>(FINNHUB_KEY).then((key) => {
        if (gen !== generation) return;
        finnhubKey = key ?? null;
        paint();
        if (ticker && key) dispatchFinnhubLookups(ticker, gen);
      });

      if (ticker) {
        dispatchSentimentLookups(ticker, gen);
      } else {
        currentApewisdom = null;
        currentStockTwits = null;
        currentNews = null;
        currentEarnings = null;
        paint();
      }
    },
    (e) => {
      if (gen !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", e);
      currentTicker = null;
      currentApewisdom = null;
      currentStockTwits = null;
      currentNews = null;
      currentEarnings = null;
      finnhubKey = null;
      paint();
    },
  );
});
```

- [ ] **Step 2: Add the Finnhub host permission in `manifest.config.ts`** — add this entry to the `host_permissions` array (after the stocktwits entry):

```ts
    "https://finnhub.io/*",
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification (Firefox)**

1. `about:debugging` → This Firefox → Load Temporary Add-on → select the built `manifest.json`.
2. Open a US-listed stock on Scalable (e.g. `?isin=US0378331005`).
3. Side Panel: with no Finnhub key, the News section shows a key input; the Earnings row is hidden. Enter a Finnhub API key, Save → News populates (Top-5 with catalyst tags) and the Next-earnings row appears.
4. SPA-navigate to another stock: news/earnings refresh; the key persists (stored).

- [ ] **Step 5: Commit**

```bash
git add src/content/index.tsx manifest.config.ts
git commit -m "feat(content): wire Finnhub news/earnings + key gating; add finnhub host permission"
```

---

## Self-Review notes

- **Spec coverage:** catalyst classifier + label map (Task 1); company-news fetch with 7-day window/top-5/tags (Task 2); next-earnings with EPS (Task 3); TTL service gated on stored key, no stale-null (Task 4); message routing + background wiring (Task 5); NewsSection key-form/list/states + EarningsRow + CSS (Task 6); Side Panel integration with key-gated earnings row (Task 7); content key-read/dispatch + manifest host permission + manual verification (Task 8). All spec sections covered.
- **Type consistency:** `NewsItem`, `EarningsDate`, `CatalystTag`, `CATALYST_LABEL`, `classifyCatalyst`, `fetchCompanyNews`, `fetchNextEarnings`, `createFinnhubService(store, newsFetcher, earningsFetcher)`, `FinnhubService.news/earnings`, message types `finnhub:news`/`finnhub:earnings`, handler names `lookupFinnhubNews`/`lookupFinnhubEarnings`, and the `NewsSection`/`EarningsRow` props are identical across all tasks.
- **Key gating:** the service gates on the key BEFORE the cache (no stale-null after a key is added); the content layer is the primary gate and only dispatches when a key exists; the earnings row is hidden in the panel until a key is present, so a missing key never shows a misleading "Loading" earnings state.
- **Scope honored:** Alpha Vantage, full Settings UI, and invalid-key-vs-empty distinction are deferred per the spec.
```

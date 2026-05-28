# Tradestie + StockTwits adapters + per-source breakdown (Build Step 4) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Two more sentiment sources rendered in the Side Panel alongside Apewisdom — StockTwits prominent at top, Apewisdom + Tradestie below. Each shown with its native metrics, no fusion yet. Aggregation/Barometer arrives in the next plan, informed by what we see here.

**Architecture:**
- **Tradestie**: one-shot full-list snapshot, 15 min TTL — same pattern as Apewisdom.
- **StockTwits**: per-ticker fetch (no snapshot endpoint), 15 min TTL keyed on the ticker.
- Background `handleMessage` refactored to take a `MessageHandlers` object — adding the second and third source would otherwise turn the positional signature into mush.
- SidePanel grows three source-sub-components. StockTwits is the first section with bigger headline + accent treatment; the other two are equal-weight below.
- Content script fires all three lookups in parallel after the ticker resolves; each paints independently as it lands (progressive disclosure, generation-guarded).

**Tech Stack:** No new deps.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `src/lib/tradestie.ts` | `fetchTradestieSnapshot(fetch) → Promise<Map<ticker, TradestieEntry>>` |
| `src/lib/tradestie.test.ts` | Vitest |
| `src/lib/stocktwits.ts` | `fetchStockTwitsForTicker(ticker, fetch) → Promise<StockTwitsEntry \| null>` |
| `src/lib/stocktwits.test.ts` | Vitest |
| `src/background/tradestie-service.ts` | TTL-cached snapshot + per-ticker map walk |
| `src/background/tradestie-service.test.ts` | Vitest |
| `src/background/stocktwits-service.ts` | Per-ticker TTL cache wrapping the adapter |
| `src/background/stocktwits-service.test.ts` | Vitest |
| `src/background/messages.ts` | Refactored to `MessageHandlers` object; three new message types |
| `src/background/messages.test.ts` | Refactor + new branches |
| `src/background/index.ts` | Wire three services into handler object |
| `src/content/SidePanel.tsx` | Three source sections, StockTwits prominent |
| `src/content/SidePanel.test.tsx` | Cover all source states |
| `src/content/sidePanel.css` | Style StockTwits prominently |
| `src/content/index.tsx` | Parallel lookups, three pieces of state |
| `manifest.config.ts` | Two new host_permissions; bump 0.0.6 |

---

## API shapes

### Tradestie
`GET https://tradestie.com/api/v1/apps/reddit` (most recent day; date param optional, omit for current).
Response: array of `{ ticker, no_of_comments, sentiment, sentiment_score }`. `sentiment` ∈ `"Bullish"|"Bearish"|"Neutral"`, `sentiment_score` ≈ 0..1.

```ts
interface TradestieEntry {
  comments: number;
  sentimentLabel: "Bullish" | "Bearish" | "Neutral";
  sentimentScore: number; // 0..1 raw from API
}
```

### StockTwits
`GET https://api.stocktwits.com/api/2/streams/symbol/{SYMBOL}.json`
Response: `{ messages: [{ entities: { sentiment: { basic: "Bullish"|"Bearish" } | null } }, ...] }`. Up to 30 most recent messages. Free tier rate-limit: 200/hour anonymous.

```ts
interface StockTwitsEntry {
  bullish: number;
  bearish: number;
  totalMessages: number; // include untagged for context
}
```

If the response is malformed or symbol not found (`response.errors`), return `null`. Non-2xx throws.

---

## Task 1: Tradestie adapter (TDD)

**Files:** Create `src/lib/tradestie.ts`, `src/lib/tradestie.test.ts`.

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchTradestieSnapshot } from "./tradestie";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

describe("fetchTradestieSnapshot", () => {
  it("requests the reddit endpoint and maps entries by ticker", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      ok([
        { ticker: "TSLA", no_of_comments: 320, sentiment: "Bullish", sentiment_score: 0.71 },
        { ticker: "AAPL", no_of_comments: 110, sentiment: "Neutral", sentiment_score: 0.5 },
      ]),
    );

    const map = await fetchTradestieSnapshot(fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://tradestie.com/api/v1/apps/reddit",
    );
    expect(map.get("TSLA")).toEqual({
      comments: 320,
      sentimentLabel: "Bullish",
      sentimentScore: 0.71,
    });
    expect(map.get("AAPL")?.sentimentLabel).toBe("Neutral");
    expect(map.size).toBe(2);
  });

  it("returns an empty map when no results", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([]));
    expect((await fetchTradestieSnapshot(fetchFn)).size).toBe(0);
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    await expect(fetchTradestieSnapshot(fetchFn)).rejects.toThrow(/503/);
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Implement**

```ts
const ENDPOINT = "https://tradestie.com/api/v1/apps/reddit";

export interface TradestieEntry {
  comments: number;
  sentimentLabel: "Bullish" | "Bearish" | "Neutral";
  sentimentScore: number;
}

export type TradestieSnapshot = Map<string, TradestieEntry>;

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawEntry {
  ticker: string;
  no_of_comments: number;
  sentiment: TradestieEntry["sentimentLabel"];
  sentiment_score: number;
}

export async function fetchTradestieSnapshot(
  fetchFn: FetchFn,
): Promise<TradestieSnapshot> {
  const response = await fetchFn(ENDPOINT);
  if (!response.ok) throw new Error(`Tradestie returned ${response.status}`);
  const body = (await response.json()) as RawEntry[];
  const map: TradestieSnapshot = new Map();
  for (const raw of body) {
    map.set(raw.ticker, {
      comments: raw.no_of_comments,
      sentimentLabel: raw.sentiment,
      sentimentScore: raw.sentiment_score,
    });
  }
  return map;
}
```

- [ ] **Step 4: green 3/3.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: commit** `feat(lib): tradestie adapter — reddit-wsb snapshot to ticker map`.

---

## Task 2: Tradestie service

**Files:** Create `src/background/tradestie-service.ts`, `.test.ts`.

Mirror `apewisdom-service` exactly: TTL cache of serialised snapshot, lookup is map walk returning entry or null.

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { TradestieEntry } from "../lib/tradestie";
import { createTradestieService } from "./tradestie-service";

const entry = (label: TradestieEntry["sentimentLabel"]): TradestieEntry => ({
  comments: 100,
  sentimentLabel: label,
  sentimentScore: 0.7,
});

describe("createTradestieService", () => {
  it("returns the entry for a ticker present in the snapshot", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Map([["AAPL", entry("Bullish")]]));
    const service = createTradestieService(createInMemoryKvStore(), fetcher);
    expect(await service.lookup("AAPL")).toEqual(entry("Bullish"));
  });

  it("returns null for a ticker absent from the snapshot", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Map([["TSLA", entry("Bullish")]]));
    const service = createTradestieService(createInMemoryKvStore(), fetcher);
    expect(await service.lookup("NOPE")).toBeNull();
  });

  it("fetches at most once within the ttl window", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Map([["AAPL", entry("Bullish")], ["TSLA", entry("Bearish")]]));
    const service = createTradestieService(createInMemoryKvStore(), fetcher);
    await service.lookup("AAPL");
    await service.lookup("TSLA");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Implement**

```ts
import type { KvStore } from "../lib/kv-store";
import type { TradestieEntry, TradestieSnapshot } from "../lib/tradestie";
import { createTtlCache } from "../lib/ttl-cache";

const SNAPSHOT_KEY = "snapshot";
const TTL_MS = 15 * 60 * 1000;

export type TradestieFetcher = () => Promise<TradestieSnapshot>;

export interface TradestieService {
  lookup(ticker: string): Promise<TradestieEntry | null>;
}

interface SerialisedSnapshot {
  entries: Array<[string, TradestieEntry]>;
}

export function createTradestieService(
  store: KvStore,
  fetcher: TradestieFetcher,
): TradestieService {
  const cache = createTtlCache<SerialisedSnapshot>(
    store,
    async () => ({ entries: Array.from((await fetcher()).entries()) }),
    { ttlMs: TTL_MS, keyPrefix: "tradestie" },
  );

  return {
    async lookup(ticker: string): Promise<TradestieEntry | null> {
      const serialised = await cache.get(SNAPSHOT_KEY);
      return new Map(serialised.entries).get(ticker) ?? null;
    },
  };
}
```

- [ ] **Step 4: green 3/3.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: commit** `feat(background): tradestie service — ttl-cached snapshot lookup`.

---

## Task 3: StockTwits adapter (TDD)

**Files:** Create `src/lib/stocktwits.ts`, `src/lib/stocktwits.test.ts`.

Different shape from the snapshot sources: per-ticker fetch, returns counts.

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchStockTwitsForTicker } from "./stocktwits";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

const message = (basic: "Bullish" | "Bearish" | null) => ({
  entities: { sentiment: basic ? { basic } : null },
});

describe("fetchStockTwitsForTicker", () => {
  it("requests the per-symbol stream endpoint", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ messages: [] }));
    await fetchStockTwitsForTicker("AAPL", fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.stocktwits.com/api/2/streams/symbol/AAPL.json",
    );
  });

  it("counts bullish, bearish, and total messages", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      ok({
        messages: [
          message("Bullish"),
          message("Bullish"),
          message("Bearish"),
          message(null),
        ],
      }),
    );
    expect(await fetchStockTwitsForTicker("AAPL", fetchFn)).toEqual({
      bullish: 2,
      bearish: 1,
      totalMessages: 4,
    });
  });

  it("returns null when the response carries an errors array", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      ok({ errors: [{ message: "Symbol not found." }] }),
    );
    expect(await fetchStockTwitsForTicker("XYZZY", fetchFn)).toBeNull();
  });

  it("returns null when messages array is missing", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({}));
    expect(await fetchStockTwitsForTicker("AAPL", fetchFn)).toBeNull();
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("rate", { status: 429 }));
    await expect(fetchStockTwitsForTicker("AAPL", fetchFn)).rejects.toThrow(/429/);
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Implement**

```ts
const BASE = "https://api.stocktwits.com/api/2/streams/symbol";

export interface StockTwitsEntry {
  bullish: number;
  bearish: number;
  totalMessages: number;
}

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RawMessage {
  entities?: { sentiment?: { basic?: "Bullish" | "Bearish" } | null };
}

interface RawResponse {
  messages?: RawMessage[];
  errors?: unknown;
}

export async function fetchStockTwitsForTicker(
  ticker: string,
  fetchFn: FetchFn,
): Promise<StockTwitsEntry | null> {
  const response = await fetchFn(`${BASE}/${ticker}.json`);
  if (!response.ok) throw new Error(`StockTwits returned ${response.status}`);
  const body = (await response.json()) as RawResponse;
  if (body.errors || !Array.isArray(body.messages)) return null;

  let bullish = 0;
  let bearish = 0;
  for (const msg of body.messages) {
    const tag = msg.entities?.sentiment?.basic;
    if (tag === "Bullish") bullish++;
    else if (tag === "Bearish") bearish++;
  }
  return { bullish, bearish, totalMessages: body.messages.length };
}
```

- [ ] **Step 4: green 5/5.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: commit** `feat(lib): stocktwits adapter — per-symbol bullish/bearish counts`.

---

## Task 4: StockTwits service

**Files:** Create `src/background/stocktwits-service.ts`, `.test.ts`.

Per-ticker TTL cache — `createTtlCache` takes ticker as the key.

- [ ] **Step 1: Tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { createStockTwitsService } from "./stocktwits-service";

const entry = (b: number, r: number): StockTwitsEntry => ({
  bullish: b,
  bearish: r,
  totalMessages: b + r,
});

describe("createStockTwitsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); });

  it("fetches once per ticker within the ttl", async () => {
    const fetcher = vi.fn().mockResolvedValue(entry(8, 2));
    const service = createStockTwitsService(createInMemoryKvStore(), fetcher);

    expect(await service.lookup("AAPL")).toEqual(entry(8, 2));
    expect(await service.lookup("AAPL")).toEqual(entry(8, 2));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fetches separately per ticker", async () => {
    const fetcher = vi.fn(async (t: string) =>
      t === "AAPL" ? entry(8, 2) : entry(3, 5),
    );
    const service = createStockTwitsService(createInMemoryKvStore(), fetcher);

    expect(await service.lookup("AAPL")).toEqual(entry(8, 2));
    expect(await service.lookup("TSLA")).toEqual(entry(3, 5));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns null and caches null", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const service = createStockTwitsService(createInMemoryKvStore(), fetcher);

    expect(await service.lookup("XYZZY")).toBeNull();
    expect(await service.lookup("XYZZY")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Implement**

```ts
import type { KvStore } from "../lib/kv-store";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { createTtlCache } from "../lib/ttl-cache";

const TTL_MS = 15 * 60 * 1000;

export type StockTwitsFetcher = (ticker: string) => Promise<StockTwitsEntry | null>;

export interface StockTwitsService {
  lookup(ticker: string): Promise<StockTwitsEntry | null>;
}

export function createStockTwitsService(
  store: KvStore,
  fetcher: StockTwitsFetcher,
): StockTwitsService {
  const cache = createTtlCache<StockTwitsEntry | null>(store, fetcher, {
    ttlMs: TTL_MS,
    keyPrefix: "stocktwits",
  });

  return {
    lookup(ticker: string): Promise<StockTwitsEntry | null> {
      return cache.get(ticker);
    },
  };
}
```

- [ ] **Step 4: green 3/3.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: commit** `feat(background): stocktwits service — per-ticker ttl cache`.

---

## Task 5: Refactor messages dispatcher + add tradestie + stocktwits

**Files:** Modify `src/background/messages.ts`, `src/background/messages.test.ts`.

Switch the signature from `handleMessage(message, fetchTicker, lookupApewisdom)` to `handleMessage(message, handlers)`. Adds two more message types and branches.

- [ ] **Step 1: Replace `src/background/messages.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import { handleMessage, type MessageHandlers } from "./messages";

const handlers = (
  overrides: Partial<MessageHandlers> = {},
): MessageHandlers => ({
  fetchTicker: vi.fn(),
  lookupApewisdom: vi.fn(),
  lookupTradestie: vi.fn(),
  lookupStockTwits: vi.fn(),
  ...overrides,
});

describe("handleMessage", () => {
  it("routes ticker:lookup", async () => {
    const fetchTicker = vi.fn().mockResolvedValue("AAPL");
    const h = handlers({ fetchTicker });
    await expect(
      handleMessage({ type: "ticker:lookup", isin: "US0378331005" }, h),
    ).resolves.toBe("AAPL");
    expect(fetchTicker).toHaveBeenCalledWith("US0378331005");
  });

  it("routes apewisdom:lookup", async () => {
    const entry: ApewisdomEntry = { rank: 1, mentions: 1, mentions24hAgo: 1, sentimentScore: 1 };
    const lookupApewisdom = vi.fn().mockResolvedValue(entry);
    await expect(
      handleMessage({ type: "apewisdom:lookup", ticker: "AAPL" }, handlers({ lookupApewisdom })),
    ).resolves.toBe(entry);
  });

  it("routes tradestie:lookup", async () => {
    const entry: TradestieEntry = { comments: 50, sentimentLabel: "Bullish", sentimentScore: 0.7 };
    const lookupTradestie = vi.fn().mockResolvedValue(entry);
    await expect(
      handleMessage({ type: "tradestie:lookup", ticker: "AAPL" }, handlers({ lookupTradestie })),
    ).resolves.toBe(entry);
  });

  it("routes stocktwits:lookup", async () => {
    const entry: StockTwitsEntry = { bullish: 5, bearish: 2, totalMessages: 7 };
    const lookupStockTwits = vi.fn().mockResolvedValue(entry);
    await expect(
      handleMessage({ type: "stocktwits:lookup", ticker: "AAPL" }, handlers({ lookupStockTwits })),
    ).resolves.toBe(entry);
  });

  it("propagates rejections from any branch", async () => {
    const lookupStockTwits = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      handleMessage({ type: "stocktwits:lookup", ticker: "AAPL" }, handlers({ lookupStockTwits })),
    ).rejects.toThrow("boom");
  });

  it("returns undefined for unknown / malformed messages", () => {
    const h = handlers();
    expect(handleMessage(null, h)).toBeUndefined();
    expect(handleMessage("x", h)).toBeUndefined();
    expect(handleMessage({ type: "other" }, h)).toBeUndefined();
    expect(handleMessage({ type: "ticker:lookup" }, h)).toBeUndefined();
    expect(handleMessage({ type: "tradestie:lookup", ticker: 5 }, h)).toBeUndefined();
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Replace `src/background/messages.ts`**

```ts
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import type { TickerFetcher } from "../lib/ticker-cache";

export interface TickerLookupMessage { type: "ticker:lookup"; isin: string }
export interface ApewisdomLookupMessage { type: "apewisdom:lookup"; ticker: string }
export interface TradestieLookupMessage { type: "tradestie:lookup"; ticker: string }
export interface StockTwitsLookupMessage { type: "stocktwits:lookup"; ticker: string }

export type ApewisdomLookup = (ticker: string) => Promise<ApewisdomEntry | null>;
export type TradestieLookup = (ticker: string) => Promise<TradestieEntry | null>;
export type StockTwitsLookup = (ticker: string) => Promise<StockTwitsEntry | null>;

export interface MessageHandlers {
  fetchTicker: TickerFetcher;
  lookupApewisdom: ApewisdomLookup;
  lookupTradestie: TradestieLookup;
  lookupStockTwits: StockTwitsLookup;
}

type HasTicker = { type: string; ticker: string };

function isTickerLookup(v: unknown): v is TickerLookupMessage {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === "ticker:lookup" &&
    typeof (v as { isin?: unknown }).isin === "string"
  );
}

function isTypedTickerMessage<T extends string>(
  v: unknown,
  type: T,
): v is HasTicker & { type: T } {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === type &&
    typeof (v as { ticker?: unknown }).ticker === "string"
  );
}

export function handleMessage(
  message: unknown,
  handlers: MessageHandlers,
):
  | Promise<string | null>
  | Promise<ApewisdomEntry | null>
  | Promise<TradestieEntry | null>
  | Promise<StockTwitsEntry | null>
  | undefined {
  if (isTickerLookup(message)) return handlers.fetchTicker(message.isin);
  if (isTypedTickerMessage(message, "apewisdom:lookup")) return handlers.lookupApewisdom(message.ticker);
  if (isTypedTickerMessage(message, "tradestie:lookup")) return handlers.lookupTradestie(message.ticker);
  if (isTypedTickerMessage(message, "stocktwits:lookup")) return handlers.lookupStockTwits(message.ticker);
  return undefined;
}
```

- [ ] **Step 4: green 6/6.**
- [ ] **Step 5: typecheck.**
- [ ] **Step 6: commit** `refactor(background): handlers object + tradestie/stocktwits routes`.

---

## Task 6: Wire all services in background entry

**Files:** Modify `src/background/index.ts`.

- [ ] **Step 1: Replace**

```ts
import { fetchApewisdomSnapshot } from "../lib/apewisdom";
import { browserStorageKvStore } from "../lib/kv-store";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { fetchStockTwitsForTicker } from "../lib/stocktwits";
import { fetchTradestieSnapshot } from "../lib/tradestie";
import { createApewisdomService } from "./apewisdom-service";
import { createStockTwitsService } from "./stocktwits-service";
import { createTradestieService } from "./tradestie-service";
import { handleMessage } from "./messages";

const store = browserStorageKvStore(browser.storage.local);
const apewisdom = createApewisdomService(store, () => fetchApewisdomSnapshot(fetch));
const tradestie = createTradestieService(store, () => fetchTradestieSnapshot(fetch));
const stocktwits = createStockTwitsService(store, (ticker) => fetchStockTwitsForTicker(ticker, fetch));

browser.runtime.onMessage.addListener((message) =>
  handleMessage(message, {
    fetchTicker: (isin) => fetchTickerFromOpenFigi(isin, fetch),
    lookupApewisdom: (ticker) => apewisdom.lookup(ticker),
    lookupTradestie: (ticker) => tradestie.lookup(ticker),
    lookupStockTwits: (ticker) => stocktwits.lookup(ticker),
  }),
);
```

- [ ] **Step 2: typecheck + build.**
- [ ] **Step 3: commit** `feat(background): wire tradestie + stocktwits into router`.

---

## Task 7: Extend SidePanel — StockTwits prominent + 3 source sections

**Files:** Modify `src/content/SidePanel.tsx`, `src/content/SidePanel.test.tsx`, `src/content/sidePanel.css`.

Structure: title → StockTwits (large) → Apewisdom (regular) → Tradestie (regular). Each source has 4 states: `undefined` (loading), `null` (no data), object (render), and visually distinct between "no data" reasons later — Step 8 problem.

- [ ] **Step 1: Replace `src/content/SidePanel.test.tsx`**

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const apewisdom = (o: Partial<ApewisdomEntry> = {}): ApewisdomEntry => ({
  rank: 5, mentions: 247, mentions24hAgo: 180, sentimentScore: 72, ...o,
});
const tradestie = (o: Partial<TradestieEntry> = {}): TradestieEntry => ({
  comments: 132, sentimentLabel: "Bullish", sentimentScore: 0.71, ...o,
});
const stocktwits = (o: Partial<StockTwitsEntry> = {}): StockTwitsEntry => ({
  bullish: 18, bearish: 4, totalMessages: 30, ...o,
});

const defaults = {
  isOpen: true,
  ticker: "AAPL" as string | null | undefined,
  apewisdom: apewisdom() as ApewisdomEntry | null | undefined,
  tradestie: tradestie() as TradestieEntry | null | undefined,
  stocktwits: stocktwits() as StockTwitsEntry | null | undefined,
  onClose: () => {},
};

describe("<SidePanel />", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<SidePanel {...defaults} isOpen={false} />);
    expect(container.querySelector(".ape-intel-panel")).toBeNull();
  });

  it("renders the ticker as title", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText("AAPL")).toBeTruthy();
  });

  it("shows a resolving message when ticker is undefined", () => {
    const { getByText } = render(
      <SidePanel {...defaults} ticker={undefined} apewisdom={undefined} tradestie={undefined} stocktwits={undefined} />,
    );
    expect(getByText(/Resolving/i)).toBeTruthy();
  });

  it("renders StockTwits prominently with bullish/bearish counts and a ratio", () => {
    const { getByText, container } = render(<SidePanel {...defaults} stocktwits={stocktwits({ bullish: 18, bearish: 4 })} />);
    expect(container.querySelector(".ape-intel-panel__source--stocktwits")).toBeTruthy();
    expect(getByText(/18/)).toBeTruthy();
    expect(getByText(/4\b/)).toBeTruthy();
    // 18 / (18+4) = 82%
    expect(getByText(/82%/)).toBeTruthy();
  });

  it("StockTwits shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} stocktwits={null} />);
    expect(getByText(/No StockTwits data/i)).toBeTruthy();
  });

  it("renders Apewisdom mentions, sentiment, rank, trend arrow", () => {
    const { getByText } = render(<SidePanel {...defaults} apewisdom={apewisdom({ mentions: 247, mentions24hAgo: 180 })} />);
    expect(getByText(/247/)).toBeTruthy();
    expect(getByText(/72/)).toBeTruthy();
    expect(getByText(/#5/)).toBeTruthy();
    expect(getByText(/↑/)).toBeTruthy();
  });

  it("Apewisdom shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} apewisdom={null} />);
    expect(getByText(/No Apewisdom data/i)).toBeTruthy();
  });

  it("renders Tradestie comments + sentiment label", () => {
    const { getByText } = render(<SidePanel {...defaults} tradestie={tradestie({ comments: 132, sentimentLabel: "Bullish" })} />);
    expect(getByText(/132/)).toBeTruthy();
    expect(getByText(/Bullish/i)).toBeTruthy();
  });

  it("Tradestie shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} tradestie={null} />);
    expect(getByText(/No Tradestie data/i)).toBeTruthy();
  });

  it("invokes onClose when close button clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SidePanel {...defaults} onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-panel__close")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Replace `src/content/SidePanel.tsx`**

```tsx
import "./sidePanel.css";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";

export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  tradestie: TradestieEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
  onClose: () => void;
}

function trendArrow(now: number, prev: number): string {
  if (now > prev) return "↑";
  if (now < prev) return "↓";
  return "→";
}

function bullishRatio(bullish: number, bearish: number): string {
  const total = bullish + bearish;
  if (total === 0) return "—";
  return `${Math.round((bullish / total) * 100)}%`;
}

function Placeholder({ children }: { children: preact.ComponentChildren }) {
  return <p class="ape-intel-panel__placeholder">{children}</p>;
}

function StockTwitsSection({ entry }: { entry: StockTwitsEntry | null | undefined }) {
  return (
    <section class="ape-intel-panel__source ape-intel-panel__source--stocktwits">
      <h3 class="ape-intel-panel__section-title">StockTwits</h3>
      {entry === undefined ? <Placeholder>Loading…</Placeholder>
      : entry === null ? <Placeholder>No StockTwits data for this ticker.</Placeholder>
      : (
        <div class="ape-intel-panel__stocktwits">
          <div class="ape-intel-panel__stocktwits-ratio">
            {bullishRatio(entry.bullish, entry.bearish)}
            <span class="ape-intel-panel__stocktwits-ratio-label">bullish</span>
          </div>
          <dl class="ape-intel-panel__stats ape-intel-panel__stats--three">
            <div><dt>Bullish</dt><dd>{entry.bullish}</dd></div>
            <div><dt>Bearish</dt><dd>{entry.bearish}</dd></div>
            <div><dt>Messages</dt><dd>{entry.totalMessages}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}

function ApewisdomSection({ entry }: { entry: ApewisdomEntry | null | undefined }) {
  return (
    <section class="ape-intel-panel__source">
      <h3 class="ape-intel-panel__section-title">Apewisdom</h3>
      {entry === undefined ? <Placeholder>Loading…</Placeholder>
      : entry === null ? <Placeholder>No Apewisdom data — ticker not in current top 250 trending.</Placeholder>
      : (
        <dl class="ape-intel-panel__stats ape-intel-panel__stats--three">
          <div>
            <dt>Mentions</dt>
            <dd>{entry.mentions}{" "}<span class="ape-intel-panel__trend">{trendArrow(entry.mentions, entry.mentions24hAgo)}</span></dd>
          </div>
          <div><dt>Sentiment</dt><dd>{entry.sentimentScore} / 100</dd></div>
          <div><dt>Rank</dt><dd>#{entry.rank}</dd></div>
        </dl>
      )}
    </section>
  );
}

function TradestieSection({ entry }: { entry: TradestieEntry | null | undefined }) {
  return (
    <section class="ape-intel-panel__source">
      <h3 class="ape-intel-panel__section-title">Tradestie (r/wallstreetbets)</h3>
      {entry === undefined ? <Placeholder>Loading…</Placeholder>
      : entry === null ? <Placeholder>No Tradestie data — ticker not in today's WSB snapshot.</Placeholder>
      : (
        <dl class="ape-intel-panel__stats ape-intel-panel__stats--two">
          <div><dt>Comments</dt><dd>{entry.comments}</dd></div>
          <div><dt>Sentiment</dt><dd>{entry.sentimentLabel}</dd></div>
        </dl>
      )}
    </section>
  );
}

export function SidePanel({
  isOpen, ticker, apewisdom, tradestie, stocktwits, onClose,
}: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside class="ape-intel-panel" aria-label="Ape Intel side panel">
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">{ticker ?? "Resolving ticker…"}</h2>
        <button type="button" class="ape-intel-panel__close" aria-label="Close side panel" onClick={onClose}>×</button>
      </header>
      <StockTwitsSection entry={stocktwits} />
      <ApewisdomSection entry={apewisdom} />
      <TradestieSection entry={tradestie} />
    </aside>
  );
}
```

(Note: `preact.ComponentChildren` requires a tiny ambient import. If TS complains, change the `Placeholder` prop type to `{ children: any }` — minor.)

- [ ] **Step 4: Update `src/content/sidePanel.css`** — replace the whole file with:

```css
.ape-intel-panel {
  position: fixed;
  right: 16px;
  bottom: 92px;
  z-index: 2147483646;
  width: 360px;
  max-height: 70vh;
  overflow-y: auto;
  background: #111;
  color: #f3f3f3;
  font: 13px/1.5 system-ui, sans-serif;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ape-intel-panel__header { display: flex; justify-content: space-between; align-items: center; }
.ape-intel-panel__title { font: 600 16px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; }
.ape-intel-panel__close {
  background: none; border: none; color: inherit; font-size: 20px;
  cursor: pointer; line-height: 1; padding: 4px 8px;
}
.ape-intel-panel__close:hover { color: #4ade80; }

.ape-intel-panel__source { border-top: 1px solid #2a2a2a; padding-top: 12px; }
.ape-intel-panel__source--stocktwits {
  border-top: none;
  padding-top: 4px;
  background: linear-gradient(180deg, rgba(74, 222, 128, 0.08), transparent);
  margin: -8px -8px 0;
  padding: 12px 8px;
  border-radius: 6px;
}
.ape-intel-panel__section-title {
  font: 600 11px/1 system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  margin: 0 0 8px;
}
.ape-intel-panel__source--stocktwits .ape-intel-panel__section-title {
  opacity: 1;
  color: #4ade80;
  font-size: 12px;
}
.ape-intel-panel__placeholder { margin: 0; opacity: 0.8; }

.ape-intel-panel__stocktwits {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ape-intel-panel__stocktwits-ratio {
  font: 700 32px/1 system-ui, sans-serif;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ape-intel-panel__stocktwits-ratio-label {
  font: 500 12px/1 system-ui, sans-serif;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ape-intel-panel__stats { margin: 0; display: grid; gap: 12px; }
.ape-intel-panel__stats--two { grid-template-columns: 1fr 1fr; }
.ape-intel-panel__stats--three { grid-template-columns: 1fr 1fr 1fr; }
.ape-intel-panel__stats > div { display: flex; flex-direction: column; }
.ape-intel-panel__stats dt { font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
.ape-intel-panel__stats dd { margin: 0; font: 600 15px/1.2 system-ui, sans-serif; }
.ape-intel-panel__trend { font-weight: 400; opacity: 0.7; margin-left: 2px; }
```

- [ ] **Step 5: green 10/10.**
- [ ] **Step 6: typecheck + full suite.**
- [ ] **Step 7: commit** `feat(content): side panel with three sources, stocktwits prominent`.

---

## Task 8: Content script — parallel lookups + new state

**Files:** Modify `src/content/index.tsx`.

Three independent fetches after ticker resolves. Each paints with its own generation guard.

- [ ] **Step 1: Replace**

```tsx
import { render } from "preact";
import { Badge } from "./Badge";
import { SidePanel } from "./SidePanel";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { TradestieEntry } from "../lib/tradestie";
import type {
  ApewisdomLookupMessage,
  StockTwitsLookupMessage,
  TickerLookupMessage,
  TradestieLookupMessage,
} from "../background/messages";

const HOST_ID = "ape-intel-host";

async function send<T>(message: unknown): Promise<T> {
  return (await browser.runtime.sendMessage(message)) as T;
}

const tickerCache = createTickerCache(
  browserStorageKvStore(browser.storage.local),
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
let currentIsin: string | null = null;
let currentTicker: string | null | undefined = undefined;
let currentApewisdom: ApewisdomEntry | null | undefined = undefined;
let currentTradestie: TradestieEntry | null | undefined = undefined;
let currentStockTwits: StockTwitsEntry | null | undefined = undefined;

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
        onClick={() => { isPanelOpen = !isPanelOpen; paint(); }}
      />
      <SidePanel
        isOpen={isPanelOpen}
        ticker={currentTicker}
        apewisdom={currentApewisdom}
        tradestie={currentTradestie}
        stocktwits={currentStockTwits}
        onClose={() => { isPanelOpen = false; paint(); }}
      />
    </>,
    ensureHost(),
  );
}

let generation = 0;

function dispatchSentimentLookups(ticker: string, gen: number): void {
  send<ApewisdomEntry | null>({ type: "apewisdom:lookup", ticker } satisfies ApewisdomLookupMessage).then(
    (entry) => { if (gen === generation) { currentApewisdom = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] apewisdom lookup failed", e); currentApewisdom = null; paint(); } },
  );
  send<TradestieEntry | null>({ type: "tradestie:lookup", ticker } satisfies TradestieLookupMessage).then(
    (entry) => { if (gen === generation) { currentTradestie = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] tradestie lookup failed", e); currentTradestie = null; paint(); } },
  );
  send<StockTwitsEntry | null>({ type: "stocktwits:lookup", ticker } satisfies StockTwitsLookupMessage).then(
    (entry) => { if (gen === generation) { currentStockTwits = entry; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] stocktwits lookup failed", e); currentStockTwits = null; paint(); } },
  );
}

observeIsin(window, (isin) => {
  generation += 1;
  const gen = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;
  currentTradestie = undefined;
  currentStockTwits = undefined;

  if (!isin) { paint(); return; }
  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (gen !== generation) return;
      currentTicker = ticker;
      paint();
      if (ticker) dispatchSentimentLookups(ticker, gen);
      else {
        // ticker = null → mark all three sentiment slots as null so the panel
        // shows the no-data branches instead of a forever loading state
        currentApewisdom = null;
        currentTradestie = null;
        currentStockTwits = null;
        paint();
      }
    },
    (e) => {
      if (gen !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", e);
      currentTicker = null;
      currentApewisdom = null;
      currentTradestie = null;
      currentStockTwits = null;
      paint();
    },
  );
});
```

- [ ] **Step 2: typecheck + tests + build.**
- [ ] **Step 3: commit** `feat(content): parallel sentiment lookups, three-source state`.

---

## Task 9: Manifest — two new hosts, bump 0.0.6

**Files:** Modify `manifest.config.ts`.

- [ ] **Step 1: Replace** the `host_permissions` array and `version`:

```ts
  version: "0.0.6",
  ...
  host_permissions: [
    "https://api.openfigi.com/*",
    "https://apewisdom.io/*",
    "https://tradestie.com/*",
    "https://api.stocktwits.com/*",
  ],
```

(All other fields untouched.)

- [ ] **Step 2: typecheck + build.** `dist/manifest.json` should read v0.0.6 with four host_permissions.
- [ ] **Step 3: commit** `feat(manifest): tradestie + stocktwits host permissions, bump 0.0.6`.

---

## Task 10: Manual Firefox verification

- [ ] **Step 1: Remove + Load Temporary Add-on** on `dist/manifest.json`. Version 0.0.6. Permissions list should show all four hosts.

- [ ] **Step 2:** Open a US security page (e.g. AAPL). Badge shows ticker. Click Badge.

- [ ] **Step 3:** SidePanel:
  - StockTwits at top with large bullish-ratio number (e.g. `82% bullish`) and bullish/bearish/messages counts. Faint green tint background.
  - Apewisdom section below with mentions/sentiment/rank.
  - Tradestie section below (labelled "Tradestie (r/wallstreetbets)") with comments + sentiment label.
  - Each may show "Loading…" briefly then real data.

- [ ] **Step 4:** Background DevTools Network:
  - First click: OpenFIGI POST + Apewisdom 5×GET + Tradestie 1×GET + StockTwits 1×GET = 8 requests.
  - Refresh page within 15 min: ticker cache hit (no OpenFIGI), snapshot caches hit (no Apewisdom/Tradestie), StockTwits cached too. Zero new network calls.
  - Navigate to a different US security within 15 min: Apewisdom + Tradestie snapshots reused (map walk); StockTwits fires per-ticker fetch (cached after first time).

- [ ] **Step 5:** Storage inspector → keys `ticker:<isin>`, `apewisdom:snapshot`, `tradestie:snapshot`, `stocktwits:<TICKER>` (one per ticker visited).

- [ ] **Step 6:** Try a DE-only ISIN: Badge no ticker, panel shows no-data placeholders in all three sources.

- [ ] **Step 7:** Try a US ticker that's almost certainly not in Tradestie's WSB list (e.g. JNJ): Tradestie section shows "no data — ticker not in today's WSB snapshot", others may have data.

- [ ] **Step 8:** Tag

```
git tag -a v0.0.6-three-sources -m "Step 4: tradestie + stocktwits, three-source per-source breakdown"
```

---

## Done criteria

- ~75 tests pass (53 prior - 5 old SidePanel + 10 new + 3 tradestie adapter + 3 tradestie service + 5 stocktwits adapter + 3 stocktwits service + 6 messages refactor - 5 old messages ≈ recount at run).
- typecheck + build exit 0.
- Firefox: all three sources render; StockTwits prominent at top; cache hits after first call; no-data branches show correctly.
- Tag `v0.0.6-three-sources` on `main`.

## Deferred

- Aggregation (Barometer + Buzz + Trend headline) — next plan, informed by qualitative observation of the three sources.
- Distinguishing "source down" from "no data for this ticker" — Step 8 polish (Coverage states copy).
- News + Earnings — Step 5 of original build order, after aggregation.

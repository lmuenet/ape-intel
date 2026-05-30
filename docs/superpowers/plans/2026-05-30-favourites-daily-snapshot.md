# Favourites + Daily Snapshot + 7-Day Sparkline (Step 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pin Assets as Favourites (star toggle, cap 20), run a once-per-UTC-day background job that appends Apewisdom data for each Favourite to a per-Asset 7-day ring buffer, and render a 7-day mentions-momentum sparkline for Favourites.

**Architecture:** Follows the existing adapter pattern — pure libs (`favourites.ts`, `snapshot-history.ts`, `sparkline.ts`) → background services (`favourites-service.ts`, `snapshot-service.ts`) → message routing (`messages.ts`) → background/content wiring → Side Panel UI. Storage via the existing `KvStore` (extended with `remove`). The daily job uses `alarms` + an idempotent UTC-day guard so a closed-browser day is caught up on next launch.

**Tech Stack:** TypeScript, Preact, Vitest, `@testing-library/preact`. Runner: `npm test`; single file: `npx vitest run <path>`; types: `npm run typecheck`; build: `npm run build`.

**Design doc:** `docs/superpowers/specs/2026-05-30-favourites-daily-snapshot-design.md`.

**Staging:** Stage A (Tasks 1–6) = Favourites. Stage B (Tasks 7–9) = Daily snapshot job. Stage C (Tasks 10–12) = Sparkline. Each stage leaves a runnable, type-clean, fully-tested extension.

---

## Stage A — Favourites

### Task 1: Extend KvStore with `remove`

**Files:**
- Modify: `src/lib/kv-store.ts`
- Test: `src/lib/kv-store.test.ts`

- [ ] **Step 1: Write the failing test** — APPEND inside the existing `describe("createInMemoryKvStore", …)` block in `src/lib/kv-store.test.ts`, before its closing `});`:

```ts
  it("removes a key so get returns undefined again", async () => {
    const store = createInMemoryKvStore({ k: "v" });
    expect(await store.get("k")).toBe("v");
    await store.remove("k");
    expect(await store.get("k")).toBeUndefined();
  });

  it("remove is a no-op for a missing key", async () => {
    const store = createInMemoryKvStore();
    await store.remove("missing");
    expect(await store.get("missing")).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/kv-store.test.ts`
Expected: FAIL — `store.remove is not a function`.

- [ ] **Step 3: Write minimal implementation** — in `src/lib/kv-store.ts`:

(a) Add `remove` to the `KvStore` interface:
```ts
export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
```
(b) Add `remove` to the in-memory store (inside the returned object):
```ts
    async remove(key: string): Promise<void> {
      data.delete(key);
    },
```
(c) Add `remove` to `BrowserStorageArea` and the browser store:
```ts
interface BrowserStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string): Promise<void>;
}
```
```ts
    async remove(key: string): Promise<void> {
      await area.remove(key);
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/kv-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kv-store.ts src/lib/kv-store.test.ts
git commit -m "feat(kv-store): add remove() for key deletion"
```

---

### Task 2: Favourites pure lib

**Files:**
- Create: `src/lib/favourites.ts`
- Test: `src/lib/favourites.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/favourites.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasFavourite, toggleFavourite, FAVOURITES_CAP, type Favourite } from "./favourites";

const fav = (isin: string, ticker = isin): Favourite => ({ isin, ticker });

describe("hasFavourite", () => {
  it("is true when the isin is present", () => {
    expect(hasFavourite([fav("US1")], "US1")).toBe(true);
  });
  it("is false when absent", () => {
    expect(hasFavourite([fav("US1")], "US2")).toBe(false);
  });
});

describe("toggleFavourite", () => {
  it("adds when absent", () => {
    expect(toggleFavourite([], fav("US1", "AAA"))).toEqual([fav("US1", "AAA")]);
  });
  it("removes when present", () => {
    expect(toggleFavourite([fav("US1"), fav("US2")], fav("US1"))).toEqual([fav("US2")]);
  });
  it("is a no-op add at the cap", () => {
    const full = [fav("A"), fav("B")];
    expect(toggleFavourite(full, fav("C"), 2)).toEqual(full);
  });
  it("still removes at the cap", () => {
    const full = [fav("A"), fav("B")];
    expect(toggleFavourite(full, fav("A"), 2)).toEqual([fav("B")]);
  });
  it("exposes a default cap of 20", () => {
    expect(FAVOURITES_CAP).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/favourites.test.ts`
Expected: FAIL — cannot find module `./favourites`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/favourites.ts`:

```ts
export interface Favourite {
  isin: string;
  ticker: string;
}

export const FAVOURITES_CAP = 20;

export function hasFavourite(list: Favourite[], isin: string): boolean {
  return list.some((f) => f.isin === isin);
}

export function toggleFavourite(
  list: Favourite[],
  fav: Favourite,
  cap: number = FAVOURITES_CAP,
): Favourite[] {
  if (hasFavourite(list, fav.isin)) {
    return list.filter((f) => f.isin !== fav.isin);
  }
  if (list.length >= cap) return list;
  return [...list, fav];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/favourites.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/favourites.ts src/lib/favourites.test.ts
git commit -m "feat(favourites): pure toggle/has ops with 20-cap"
```

---

### Task 3: Favourites background service

**Files:**
- Create: `src/background/favourites-service.ts`
- Test: `src/background/favourites-service.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/background/favourites-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { Favourite } from "../lib/favourites";
import { createFavouritesService } from "./favourites-service";

const fav = (isin: string, ticker = isin): Favourite => ({ isin, ticker });

describe("createFavouritesService", () => {
  it("returns an empty list when nothing is stored", async () => {
    const service = createFavouritesService(createInMemoryKvStore());
    expect(await service.get()).toEqual([]);
  });

  it("toggle adds and persists, returning the new membership", async () => {
    const store = createInMemoryKvStore();
    const service = createFavouritesService(store);
    expect(await service.toggle(fav("US1", "AAA"))).toBe(true);
    expect(await service.get()).toEqual([fav("US1", "AAA")]);
    expect(await service.has("US1")).toBe(true);
  });

  it("toggle removes and deletes that asset's snapshot history", async () => {
    const store = createInMemoryKvStore({
      favourites: [fav("US1")],
      "snapshot:history:US1": [{ date: "2026-05-30", mentions: 5, rank: 1 }],
    });
    const service = createFavouritesService(store);
    expect(await service.toggle(fav("US1"))).toBe(false);
    expect(await service.get()).toEqual([]);
    expect(await store.get("snapshot:history:US1")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/favourites-service.test.ts`
Expected: FAIL — cannot find module `./favourites-service`.

- [ ] **Step 3: Write minimal implementation** — create `src/background/favourites-service.ts`:

```ts
import type { KvStore } from "../lib/kv-store";
import { hasFavourite, toggleFavourite, type Favourite } from "../lib/favourites";

const FAVOURITES_KEY = "favourites";
const HISTORY_PREFIX = "snapshot:history:";

export interface FavouritesService {
  get(): Promise<Favourite[]>;
  has(isin: string): Promise<boolean>;
  toggle(fav: Favourite): Promise<boolean>;
}

export function createFavouritesService(store: KvStore): FavouritesService {
  async function get(): Promise<Favourite[]> {
    return (await store.get<Favourite[]>(FAVOURITES_KEY)) ?? [];
  }

  return {
    get,
    async has(isin: string): Promise<boolean> {
      return hasFavourite(await get(), isin);
    },
    async toggle(fav: Favourite): Promise<boolean> {
      const list = await get();
      const wasFavourite = hasFavourite(list, fav.isin);
      const next = toggleFavourite(list, fav);
      await store.set(FAVOURITES_KEY, next);
      const nowFavourite = hasFavourite(next, fav.isin);
      if (wasFavourite && !nowFavourite) {
        await store.remove(`${HISTORY_PREFIX}${fav.isin}`);
      }
      return nowFavourite;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/background/favourites-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/favourites-service.ts src/background/favourites-service.test.ts
git commit -m "feat(favourites-service): store-backed toggle/has/get; clear history on remove"
```

---

### Task 4: Route `favourites:toggle` / `favourites:has`

**Files:**
- Modify: `src/background/messages.ts`
- Modify: `src/background/messages.test.ts`

- [ ] **Step 1: Write the failing test** — in `src/background/messages.test.ts`:

(a) Add an import after the existing `import type { NewsItem, EarningsDate } …` line:
```ts
import type { Favourite } from "../lib/favourites";
```
(b) Add two fields to the `handlers` factory object (after `lookupFinnhubEarnings: vi.fn(),`):
```ts
  toggleFavourite: vi.fn(),
  isFavourite: vi.fn(),
```
(c) Append two routing tests inside `describe("handleMessage", …)`, before its closing `});`:
```ts
  it("routes favourites:toggle with isin and ticker", async () => {
    const toggleFavourite = vi.fn().mockResolvedValue(true);
    await expect(
      handleMessage({ type: "favourites:toggle", isin: "US1", ticker: "AAA" }, handlers({ toggleFavourite })),
    ).resolves.toBe(true);
    expect(toggleFavourite).toHaveBeenCalledWith({ isin: "US1", ticker: "AAA" } satisfies Favourite);
  });

  it("routes favourites:has", async () => {
    const isFavourite = vi.fn().mockResolvedValue(false);
    await expect(
      handleMessage({ type: "favourites:has", isin: "US1" }, handlers({ isFavourite })),
    ).resolves.toBe(false);
    expect(isFavourite).toHaveBeenCalledWith("US1");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/messages.test.ts`
Expected: FAIL — `toggleFavourite`/`isFavourite` not on `MessageHandlers`; routes return undefined.

- [ ] **Step 3: Write minimal implementation** — in `src/background/messages.ts`:

(a) Add a type import after `import type { TickerFetcher } …`:
```ts
import type { Favourite } from "../lib/favourites";
```
(b) Add two message interfaces after `FinnhubEarningsLookupMessage`:
```ts
export interface FavouriteToggleMessage { type: "favourites:toggle"; isin: string; ticker: string }
export interface FavouriteHasMessage { type: "favourites:has"; isin: string }
```
(c) Add two handler types after `FinnhubEarningsLookup`:
```ts
export type FavouriteToggle = (fav: Favourite) => Promise<boolean>;
export type FavouriteHas = (isin: string) => Promise<boolean>;
```
(d) Add two fields to `MessageHandlers` (after `lookupFinnhubEarnings`):
```ts
  toggleFavourite: FavouriteToggle;
  isFavourite: FavouriteHas;
```
(e) Extend the `handleMessage` return-type union with one member (boolean covers both):
```ts
  | Promise<boolean>
```
(f) Add an isin-message guard + a toggle guard after `isTypedTickerMessage`:
```ts
type HasIsin = { type: string; isin: string };

function isTypedIsinMessage<T extends string>(
  v: unknown,
  type: T,
): v is HasIsin & { type: T } {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === type &&
    typeof (v as { isin?: unknown }).isin === "string"
  );
}

function isFavouriteToggle(v: unknown): v is FavouriteToggleMessage {
  return (
    typeof v === "object" && v !== null &&
    (v as { type?: unknown }).type === "favourites:toggle" &&
    typeof (v as { isin?: unknown }).isin === "string" &&
    typeof (v as { ticker?: unknown }).ticker === "string"
  );
}
```
(g) Add two routing branches before the final `return undefined;`:
```ts
  if (isFavouriteToggle(message)) return handlers.toggleFavourite({ isin: message.isin, ticker: message.ticker });
  if (isTypedIsinMessage(message, "favourites:has")) return handlers.isFavourite(message.isin);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/background/messages.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/messages.ts src/background/messages.test.ts
git commit -m "feat(messages): route favourites:toggle/has"
```

---

### Task 5: Star toggle in the Side Panel

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/sidePanel.css`
- Modify: `src/content/SidePanel.test.tsx`

- [ ] **Step 1: Write the failing test** — in `src/content/SidePanel.test.tsx`:

(a) Add three fields to the `defaults` object (after `onTradingViewClick: () => {},`):
```ts
  isFavourite: false,
  showCapHint: false,
  onToggleFavourite: () => {},
```
(b) Append these tests inside `describe("<SidePanel />", …)`:
```ts
  it("renders a star toggle when the ticker is resolved", () => {
    const { container } = render(<SidePanel {...defaults} />);
    expect(container.querySelector(".ape-intel-panel__star")).toBeTruthy();
  });

  it("hides the star when the ticker is unresolved", () => {
    const { container } = render(<SidePanel {...defaults} ticker={null} />);
    expect(container.querySelector(".ape-intel-panel__star")).toBeNull();
  });

  it("reflects favourite state via aria-pressed", () => {
    const { container } = render(<SidePanel {...defaults} isFavourite />);
    expect(container.querySelector(".ape-intel-panel__star")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("invokes onToggleFavourite when the star is clicked", () => {
    const onToggleFavourite = vi.fn();
    const { container } = render(<SidePanel {...defaults} onToggleFavourite={onToggleFavourite} />);
    fireEvent.click(container.querySelector(".ape-intel-panel__star")!);
    expect(onToggleFavourite).toHaveBeenCalledTimes(1);
  });

  it("shows a cap hint when showCapHint is true", () => {
    const { getByText } = render(<SidePanel {...defaults} showCapHint />);
    expect(getByText(/Max 20 favourites/i)).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `isFavourite`/`onToggleFavourite`/`showCapHint` not props; no `.ape-intel-panel__star`.

- [ ] **Step 3: Write minimal implementation** — in `src/content/SidePanel.tsx`:

(a) Add three fields to `SidePanelProps` (after `onSaveKey: (key: string) => void;`):
```tsx
  isFavourite: boolean;
  showCapHint: boolean;
  onToggleFavourite: () => void;
```
(b) Update the destructured params in the `SidePanel` signature to include the new fields:
```tsx
export function SidePanel({
  isOpen, ticker, aggregate, apewisdom, stocktwits,
  news, earnings, finnhubKey, onSaveKey,
  isFavourite, showCapHint, onToggleFavourite,
  onClose, onTradingViewClick,
}: SidePanelProps) {
```
(c) Replace the `<header>…</header>` block with one that wraps the actions and adds the star + cap hint:
```tsx
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">{ticker ?? "Resolving ticker…"}</h2>
        <div class="ape-intel-panel__header-actions">
          {ticker ? (
            <button
              type="button"
              class="ape-intel-panel__star"
              aria-pressed={isFavourite}
              aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
              onClick={onToggleFavourite}
            >
              {isFavourite ? "★" : "☆"}
            </button>
          ) : null}
          <button type="button" class="ape-intel-panel__close" aria-label="Close side panel" onClick={onClose}>×</button>
        </div>
      </header>
      {ticker && showCapHint ? <p class="ape-intel-panel__cap-hint">Max 20 favourites.</p> : null}
```

- [ ] **Step 4: Append CSS to `src/content/sidePanel.css`:**

```css
.ape-intel-panel__header-actions { display: flex; align-items: center; gap: 8px; }
.ape-intel-panel__star {
  background: none; border: none; cursor: pointer; padding: 0;
  font-size: 18px; line-height: 1; color: #f5c518;
}
.ape-intel-panel__star[aria-pressed="false"] { color: #888; }
.ape-intel-panel__cap-hint { margin: 4px 0 0; font-size: 11px; opacity: 0.7; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS (existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/content/SidePanel.tsx src/content/sidePanel.css src/content/SidePanel.test.tsx
git commit -m "feat(side-panel): favourite star toggle + cap hint"
```

---

### Task 6: Wire favourites into content + background

**Files:**
- Modify: `src/content/index.tsx` (full replacement below)
- Modify: `src/background/index.ts`

> No unit test (orchestration layer); verified via typecheck.

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
  FavouriteHasMessage,
  FavouriteToggleMessage,
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
let isFavourite = false;
let showCapHint = false;

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
        isFavourite={isFavourite}
        showCapHint={showCapHint}
        onToggleFavourite={onToggleFavourite}
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
    if (typeof currentTicker === "string") dispatchFinnhubLookups(currentTicker, gen);
    else paint();
  });
}

function onToggleFavourite(): void {
  if (currentIsin === null || typeof currentTicker !== "string") return;
  const gen = generation;
  const isin = currentIsin;
  const wasFavourite = isFavourite;
  showCapHint = false;
  send<boolean>({ type: "favourites:toggle", isin, ticker: currentTicker } satisfies FavouriteToggleMessage).then(
    (nowFavourite) => {
      if (gen !== generation) return;
      isFavourite = nowFavourite;
      // Adding was rejected by the cap when the state did not flip to true.
      if (!wasFavourite && !nowFavourite) showCapHint = true;
      paint();
    },
    (e) => { if (gen === generation) console.warn("[ape-intel] favourites toggle failed", e); },
  );
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
  isFavourite = false;
  showCapHint = false;
  isChartOpen = false; // close chart on navigation

  if (!isin) { paint(); return; }
  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (gen !== generation) return;
      currentTicker = ticker;
      paint();

      if (ticker) {
        dispatchSentimentLookups(ticker, gen);
        send<boolean>({ type: "favourites:has", isin } satisfies FavouriteHasMessage).then(
          (fav) => { if (gen === generation) { isFavourite = fav; paint(); } },
          (e) => { if (gen === generation) console.warn("[ape-intel] favourites has failed", e); },
        );
        store.get<string>(FINNHUB_KEY).then((key) => {
          if (gen !== generation) return;
          finnhubKey = key ?? null;
          paint();
          if (key) dispatchFinnhubLookups(ticker, gen);
        });
      } else {
        currentApewisdom = null;
        currentStockTwits = null;
        currentNews = null;
        currentEarnings = null;
        finnhubKey = null;
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

- [ ] **Step 2: Wire the favourites service + handlers in `src/background/index.ts`:**

(a) Add an import after `import { createFinnhubService } from "./finnhub-service";`:
```ts
import { createFavouritesService } from "./favourites-service";
```
(b) Add a service instance after the `const finnhub = createFinnhubService(…);` block:
```ts
const favourites = createFavouritesService(store);
```
(c) Add two handlers to the `handleMessage` handler object (after `lookupFinnhubEarnings: …,`):
```ts
    toggleFavourite: (fav) => favourites.toggle(fav),
    isFavourite: (isin) => favourites.has(isin),
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add src/content/index.tsx src/background/index.ts
git commit -m "feat(content): wire favourite star toggle + has lookup"
```

---

## Stage B — Daily snapshot job

### Task 7: Snapshot-history pure lib

**Files:**
- Create: `src/lib/snapshot-history.ts`
- Test: `src/lib/snapshot-history.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/snapshot-history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appendDay, isSnapshotDue, utcDay, type DailySnapshot } from "./snapshot-history";

const rec = (date: string, mentions: number, rank: number | null = null): DailySnapshot => ({ date, mentions, rank });

describe("utcDay", () => {
  it("formats a timestamp as a UTC YYYY-MM-DD string", () => {
    expect(utcDay(Date.parse("2026-05-30T23:59:00Z"))).toBe("2026-05-30");
  });
});

describe("isSnapshotDue", () => {
  it("is due when no snapshot has run", () => {
    expect(isSnapshotDue(undefined, "2026-05-30")).toBe(true);
  });
  it("is due when the last run was a previous day", () => {
    expect(isSnapshotDue("2026-05-29", "2026-05-30")).toBe(true);
  });
  it("is not due when already run today", () => {
    expect(isSnapshotDue("2026-05-30", "2026-05-30")).toBe(false);
  });
});

describe("appendDay", () => {
  it("appends to an empty history", () => {
    expect(appendDay([], rec("2026-05-30", 5))).toEqual([rec("2026-05-30", 5)]);
  });
  it("replaces a same-date entry (idempotent re-run)", () => {
    expect(appendDay([rec("2026-05-30", 1, 1)], rec("2026-05-30", 9, 2)))
      .toEqual([rec("2026-05-30", 9, 2)]);
  });
  it("keeps only the most recent 7 days, sorted ascending", () => {
    const history = [
      rec("2026-05-24", 1), rec("2026-05-25", 2), rec("2026-05-26", 3),
      rec("2026-05-27", 4), rec("2026-05-28", 5), rec("2026-05-29", 6),
      rec("2026-05-30", 7),
    ];
    const result = appendDay(history, rec("2026-05-31", 8));
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual(rec("2026-05-25", 2));
    expect(result[6]).toEqual(rec("2026-05-31", 8));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/snapshot-history.test.ts`
Expected: FAIL — cannot find module `./snapshot-history`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/snapshot-history.ts`:

```ts
export interface DailySnapshot {
  date: string; // UTC YYYY-MM-DD
  mentions: number;
  rank: number | null;
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function isSnapshotDue(lastDate: string | undefined, today: string): boolean {
  return lastDate !== today;
}

export function appendDay(
  history: DailySnapshot[],
  record: DailySnapshot,
  max: number = 7,
): DailySnapshot[] {
  const withoutSameDate = history.filter((d) => d.date !== record.date);
  const next = [...withoutSameDate, record].sort((a, b) => a.date.localeCompare(b.date));
  return next.slice(-max);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/snapshot-history.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/snapshot-history.ts src/lib/snapshot-history.test.ts
git commit -m "feat(snapshot-history): utcDay + due-guard + 7-day ring buffer"
```

---

### Task 8: Snapshot background service

**Files:**
- Create: `src/background/snapshot-service.ts`
- Test: `src/background/snapshot-service.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/background/snapshot-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { Favourite } from "../lib/favourites";
import type { ApewisdomSnapshot } from "../lib/apewisdom";
import { createSnapshotService } from "./snapshot-service";

const fav = (isin: string, ticker: string): Favourite => ({ isin, ticker });
const NOW = Date.parse("2026-05-30T08:00:00Z"); // utcDay = 2026-05-30

const snapshot = (): ApewisdomSnapshot =>
  new Map([["AAA", { rank: 3, mentions: 100, mentions24hAgo: 80 }]]);

describe("createSnapshotService", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does not fetch when a snapshot already ran today", async () => {
    const store = createInMemoryKvStore({ "snapshot:lastDate": "2026-05-30" });
    const fetchSnapshot = vi.fn(async () => snapshot());
    const service = createSnapshotService(store, async () => [fav("US1", "AAA")], fetchSnapshot);
    await service.runIfDue(NOW);
    expect(fetchSnapshot).not.toHaveBeenCalled();
  });

  it("does not fetch and does not advance the date when there are no favourites", async () => {
    const store = createInMemoryKvStore();
    const fetchSnapshot = vi.fn(async () => snapshot());
    const service = createSnapshotService(store, async () => [], fetchSnapshot);
    await service.runIfDue(NOW);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(await store.get("snapshot:lastDate")).toBeUndefined();
  });

  it("fetches once, records every favourite, and advances lastDate", async () => {
    const store = createInMemoryKvStore();
    const fetchSnapshot = vi.fn(async () => snapshot());
    const service = createSnapshotService(
      store,
      async () => [fav("US1", "AAA"), fav("US2", "ZZZ")],
      fetchSnapshot,
    );
    await service.runIfDue(NOW);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    // Present in the Apewisdom snapshot:
    expect(await service.history("US1")).toEqual([{ date: "2026-05-30", mentions: 100, rank: 3 }]);
    // Absent ticker → mentions 0, rank null:
    expect(await service.history("US2")).toEqual([{ date: "2026-05-30", mentions: 0, rank: null }]);
    expect(await store.get("snapshot:lastDate")).toBe("2026-05-30");
  });

  it("history returns an empty array for an unknown asset", async () => {
    const service = createSnapshotService(createInMemoryKvStore(), async () => [], vi.fn());
    expect(await service.history("US9")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/snapshot-service.test.ts`
Expected: FAIL — cannot find module `./snapshot-service`.

- [ ] **Step 3: Write minimal implementation** — create `src/background/snapshot-service.ts`:

```ts
import type { KvStore } from "../lib/kv-store";
import type { Favourite } from "../lib/favourites";
import type { ApewisdomSnapshot } from "../lib/apewisdom";
import {
  appendDay,
  isSnapshotDue,
  utcDay,
  type DailySnapshot,
} from "../lib/snapshot-history";

const LAST_DATE_KEY = "snapshot:lastDate";
const HISTORY_PREFIX = "snapshot:history:";

export type FavouritesSource = () => Promise<Favourite[]>;
export type SnapshotFetcher = () => Promise<ApewisdomSnapshot>;

export interface SnapshotService {
  runIfDue(now: number): Promise<void>;
  history(isin: string): Promise<DailySnapshot[]>;
}

export function createSnapshotService(
  store: KvStore,
  getFavourites: FavouritesSource,
  fetchSnapshot: SnapshotFetcher,
): SnapshotService {
  async function history(isin: string): Promise<DailySnapshot[]> {
    return (await store.get<DailySnapshot[]>(`${HISTORY_PREFIX}${isin}`)) ?? [];
  }

  return {
    history,
    async runIfDue(now: number): Promise<void> {
      const today = utcDay(now);
      const lastDate = await store.get<string>(LAST_DATE_KEY);
      if (!isSnapshotDue(lastDate, today)) return;

      const favourites = await getFavourites();
      if (favourites.length === 0) return;

      const apewisdom = await fetchSnapshot();
      for (const fav of favourites) {
        const entry = apewisdom.get(fav.ticker);
        const record: DailySnapshot = {
          date: today,
          mentions: entry?.mentions ?? 0,
          rank: entry?.rank ?? null,
        };
        const next = appendDay(await history(fav.isin), record);
        await store.set(`${HISTORY_PREFIX}${fav.isin}`, next);
      }
      await store.set(LAST_DATE_KEY, today);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/background/snapshot-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/snapshot-service.ts src/background/snapshot-service.test.ts
git commit -m "feat(snapshot-service): daily UTC-guarded Apewisdom snapshot per favourite"
```

---

### Task 9: Schedule the job + manifest permission

**Files:**
- Modify: `src/background/index.ts`
- Modify: `manifest.config.ts`

> No unit test (orchestration + manifest); verified via typecheck + build.

- [ ] **Step 1: Add the `alarms` permission in `manifest.config.ts`** — change the `permissions` array:

```ts
  permissions: ["storage", "alarms"],
```

- [ ] **Step 2: Wire the snapshot service + scheduling in `src/background/index.ts`:**

(a) Add an import after `import { createFavouritesService } from "./favourites-service";`:
```ts
import { createSnapshotService } from "./snapshot-service";
```
(b) Add a service instance after `const favourites = createFavouritesService(store);`:
```ts
const snapshot = createSnapshotService(
  store,
  () => favourites.get(),
  () => fetchApewisdomSnapshot(fetch),
);
```
(c) Add scheduling at the end of the file (after the `onMessage` listener):
```ts
const DAILY_SNAPSHOT_ALARM = "daily-snapshot";
// Poll hourly; the UTC-day guard inside runIfDue makes this at-most-once-per-day.
browser.alarms.create(DAILY_SNAPSHOT_ALARM, { periodInMinutes: 60 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_SNAPSHOT_ALARM) void snapshot.runIfDue(Date.now());
});
// Catch up a missed day as soon as the browser comes back.
browser.runtime.onStartup.addListener(() => void snapshot.runIfDue(Date.now()));
browser.runtime.onInstalled.addListener(() => void snapshot.runIfDue(Date.now()));
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; `dist/manifest.json` lists `alarms` in `permissions`.

- [ ] **Step 4: Commit**

```bash
git add src/background/index.ts manifest.config.ts
git commit -m "feat(background): schedule daily snapshot via alarms + startup catch-up"
```

---

## Stage C — Sparkline

### Task 10: Sparkline pure lib

**Files:**
- Create: `src/lib/sparkline.ts`
- Test: `src/lib/sparkline.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/sparkline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("maps a rising series across the full width and inverted height", () => {
    // min=1 → y=height(10); max=3 → y=0; mid=2 → y=5. width=100, 3 points.
    expect(sparklinePoints([1, 2, 3], 100, 10)).toBe("0.0,10.0 50.0,5.0 100.0,0.0");
  });
  it("draws a flat series on the mid-line", () => {
    expect(sparklinePoints([5, 5], 100, 10)).toBe("0.0,5.0 100.0,5.0");
  });
  it("places a single value at x=0 on the mid-line", () => {
    expect(sparklinePoints([7], 100, 10)).toBe("0.0,5.0");
  });
  it("returns an empty string for no values", () => {
    expect(sparklinePoints([], 100, 10)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sparkline.test.ts`
Expected: FAIL — cannot find module `./sparkline`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/sparkline.ts`:

```ts
// Maps a number series to an SVG polyline `points` string. Y is inverted
// (SVG origin is top-left) so larger values sit higher. A flat series renders
// on the mid-line.
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = span === 0 ? height / 2 : height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sparkline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sparkline.ts src/lib/sparkline.test.ts
git commit -m "feat(sparkline): pure series-to-SVG-points mapping"
```

---

### Task 11: Sparkline UI component

**Files:**
- Create: `src/content/Sparkline.tsx`
- Modify: `src/content/sidePanel.css`
- Test: `src/content/Sparkline.test.tsx`

- [ ] **Step 1: Write the failing test** — create `src/content/Sparkline.test.tsx`:

```tsx
import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import type { DailySnapshot } from "../lib/snapshot-history";
import { SparklineSection } from "./Sparkline";

afterEach(cleanup);

const rec = (date: string, mentions: number): DailySnapshot => ({ date, mentions, rank: null });

describe("<SparklineSection />", () => {
  it("shows Loading when history is undefined", () => {
    const { getByText } = render(<SparklineSection history={undefined} />);
    expect(getByText(/Loading/i)).toBeTruthy();
  });

  it("shows an error message when history is null", () => {
    const { getByText } = render(<SparklineSection history={null} />);
    expect(getByText(/Couldn't load momentum/i)).toBeTruthy();
  });

  it("shows a collecting message with the count when fewer than 2 points", () => {
    const { getByText } = render(<SparklineSection history={[rec("2026-05-30", 5)]} />);
    expect(getByText(/Collecting data \(1\/7\)/i)).toBeTruthy();
  });

  it("renders an SVG polyline and the current mentions when 2+ points", () => {
    const { container, getByText } = render(
      <SparklineSection history={[rec("2026-05-29", 5), rec("2026-05-30", 9)]} />,
    );
    expect(container.querySelector("polyline.ape-intel-spark__line")).toBeTruthy();
    expect(getByText(/9 mentions/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/Sparkline.test.tsx`
Expected: FAIL — cannot find module `./Sparkline`.

- [ ] **Step 3: Write minimal implementation** — create `src/content/Sparkline.tsx`:

```tsx
import { sparklinePoints } from "../lib/sparkline";
import type { DailySnapshot } from "../lib/snapshot-history";

const SPARK_W = 120;
const SPARK_H = 28;

export interface SparklineSectionProps {
  history: DailySnapshot[] | null | undefined;
}

function Sparkline({ values }: { values: number[] }) {
  return (
    <svg
      class="ape-intel-spark__svg"
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label="7-day mentions trend"
    >
      <polyline class="ape-intel-spark__line" fill="none" points={sparklinePoints(values, SPARK_W, SPARK_H)} />
    </svg>
  );
}

export function SparklineSection({ history }: SparklineSectionProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-spark">
      <h3 class="ape-intel-panel__section-title">7-day momentum</h3>
      {history === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : history === null ? <p class="ape-intel-panel__placeholder">Couldn't load momentum.</p>
      : history.length < 2 ? <p class="ape-intel-panel__placeholder">Collecting data ({history.length}/7)…</p>
      : (
        <div class="ape-intel-spark__body">
          <Sparkline values={history.map((d) => d.mentions)} />
          <span class="ape-intel-spark__current">{history[history.length - 1].mentions} mentions</span>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Append CSS to `src/content/sidePanel.css`:**

```css
.ape-intel-spark__body { display: flex; align-items: center; gap: 10px; }
.ape-intel-spark__svg { display: block; }
.ape-intel-spark__line { stroke: #4ade80; stroke-width: 2; }
.ape-intel-spark__current { font-size: 12px; opacity: 0.8; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/content/Sparkline.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/Sparkline.tsx src/content/Sparkline.test.tsx src/content/sidePanel.css
git commit -m "feat(content): SparklineSection with loading/error/collecting/chart states"
```

---

### Task 12: Integrate the sparkline (message + panel + wiring)

**Files:**
- Modify: `src/background/messages.ts`
- Modify: `src/background/messages.test.ts`
- Modify: `src/background/index.ts`
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/SidePanel.test.tsx`
- Modify: `src/content/index.tsx`

- [ ] **Step 1: Write the failing routing test** — in `src/background/messages.test.ts`:

(a) Add an import after `import type { Favourite } …`:
```ts
import type { DailySnapshot } from "../lib/snapshot-history";
```
(b) Add a field to the `handlers` factory object (after `isFavourite: vi.fn(),`):
```ts
  getSnapshotHistory: vi.fn(),
```
(c) Append a routing test inside `describe("handleMessage", …)`:
```ts
  it("routes snapshot:history", async () => {
    const history: DailySnapshot[] = [{ date: "2026-05-30", mentions: 5, rank: 1 }];
    const getSnapshotHistory = vi.fn().mockResolvedValue(history);
    await expect(
      handleMessage({ type: "snapshot:history", isin: "US1" }, handlers({ getSnapshotHistory })),
    ).resolves.toBe(history);
    expect(getSnapshotHistory).toHaveBeenCalledWith("US1");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/messages.test.ts`
Expected: FAIL — `getSnapshotHistory` not on `MessageHandlers`; route returns undefined.

- [ ] **Step 3: Route `snapshot:history` in `src/background/messages.ts`:**

(a) Add a type import after `import type { Favourite } …`:
```ts
import type { DailySnapshot } from "../lib/snapshot-history";
```
(b) Add a message interface after `FavouriteHasMessage`:
```ts
export interface SnapshotHistoryMessage { type: "snapshot:history"; isin: string }
```
(c) Add a handler type after `FavouriteHas`:
```ts
export type SnapshotHistoryLookup = (isin: string) => Promise<DailySnapshot[]>;
```
(d) Add a field to `MessageHandlers` (after `isFavourite`):
```ts
  getSnapshotHistory: SnapshotHistoryLookup;
```
(e) Extend the `handleMessage` return-type union with one member:
```ts
  | Promise<DailySnapshot[]>
```
(f) Add a routing branch before the final `return undefined;`:
```ts
  if (isTypedIsinMessage(message, "snapshot:history")) return handlers.getSnapshotHistory(message.isin);
```

- [ ] **Step 4: Run test to verify routing passes**

Run: `npx vitest run src/background/messages.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Wire the handler in `src/background/index.ts`** — add to the `handleMessage` handler object (after `isFavourite: …,`):

```ts
    getSnapshotHistory: (isin) => snapshot.history(isin),
```

- [ ] **Step 6: Write the failing Side Panel test** — in `src/content/SidePanel.test.tsx`:

(a) Add a field to the `defaults` object (after `onToggleFavourite: () => {},`):
```ts
  history: [] as import("../lib/snapshot-history").DailySnapshot[] | null | undefined,
```
(b) Append these tests inside `describe("<SidePanel />", …)`:
```ts
  it("renders the momentum section when the asset is a favourite", () => {
    const history = [
      { date: "2026-05-29", mentions: 5, rank: 1 },
      { date: "2026-05-30", mentions: 9, rank: 1 },
    ];
    const { getByText } = render(<SidePanel {...defaults} isFavourite history={history} />);
    expect(getByText(/7-day momentum/i)).toBeTruthy();
    expect(getByText(/9 mentions/i)).toBeTruthy();
  });

  it("hides the momentum section when not a favourite", () => {
    const { queryByText } = render(<SidePanel {...defaults} isFavourite={false} />);
    expect(queryByText(/7-day momentum/i)).toBeNull();
  });
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `history` not a prop; no "7-day momentum" section.

- [ ] **Step 8: Render the sparkline in `src/content/SidePanel.tsx`:**

(a) Add imports after `import type { EarningsDate, NewsItem } from "../lib/finnhub";`:
```tsx
import { SparklineSection } from "./Sparkline";
import type { DailySnapshot } from "../lib/snapshot-history";
```
(b) Add a field to `SidePanelProps` (after `onToggleFavourite: () => void;`):
```tsx
  history: DailySnapshot[] | null | undefined;
```
(c) Add `history` to the destructured params (in the `isFavourite, showCapHint, onToggleFavourite,` line):
```tsx
  isFavourite, showCapHint, onToggleFavourite, history,
```
(d) Render the section just before `<ExternalLinksBar … />`:
```tsx
      {ticker && isFavourite ? <SparklineSection history={history} /> : null}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS (existing + 2 new).

- [ ] **Step 10: Wire history fetching in `src/content/index.tsx`:**

(a) Add an import to the message-types import block (after `FinnhubNewsLookupMessage,`):
```tsx
  SnapshotHistoryMessage,
```
(b) Add an import after `import type { EarningsDate, NewsItem } from "../lib/finnhub";`:
```tsx
import type { DailySnapshot } from "../lib/snapshot-history";
```
(c) Add a state variable after `let showCapHint = false;`:
```tsx
let currentHistory: DailySnapshot[] | null | undefined = undefined;
```
(d) Pass it to `<SidePanel>` (after `onToggleFavourite={onToggleFavourite}`):
```tsx
        history={currentHistory}
```
(e) Add a history-dispatch helper after the `dispatchFinnhubLookups` function:
```tsx
function dispatchHistoryLookup(isin: string, gen: number): void {
  currentHistory = undefined;
  paint();
  send<DailySnapshot[]>({ type: "snapshot:history", isin } satisfies SnapshotHistoryMessage).then(
    (history) => { if (gen === generation) { currentHistory = history; paint(); } },
    (e) => { if (gen === generation) { console.warn("[ape-intel] snapshot history lookup failed", e); currentHistory = null; paint(); } },
  );
}
```
(f) In `onToggleFavourite`, after `isFavourite = nowFavourite;`, fetch or clear history:
```tsx
      if (nowFavourite) dispatchHistoryLookup(isin, gen);
      else currentHistory = undefined;
```
(g) In the `favourites:has` resolution inside `observeIsin` (the `(fav) => { … }` callback), fetch history when already a favourite. Replace that success callback body with:
```tsx
          (fav) => { if (gen === generation) { isFavourite = fav; paint(); if (fav) dispatchHistoryLookup(isin, gen); } },
```
(h) Reset history on navigation — in the `observeIsin` reset block, after `showCapHint = false;`:
```tsx
  currentHistory = undefined;
```

- [ ] **Step 11: Verify everything**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 12: Manual verification (Firefox)**

1. `npm run build`, then `about:debugging` → This Firefox → Load Temporary Add-on → select `dist/manifest.json` (confirm version `0.0.x` matches the build).
2. Open a US-listed stock on Scalable (e.g. `?isin=US0378331005`), open the Side Panel.
3. Click the star → it fills (★); the "7-day momentum" section appears showing "Collecting data (0/7)…" (no snapshot has run yet).
4. Force a snapshot: in the extension's background console (`about:debugging` → Inspect), the hourly alarm / startup handler runs `runIfDue`; or reload the add-on to trigger `onInstalled`. After a run, the section shows "Collecting data (1/7)…".
5. Un-star → the section disappears; re-opening another favourite still shows its own series.
6. Add 20 favourites, then try a 21st → the star does not fill and a "Max 20 favourites." hint shows.

- [ ] **Step 13: Commit**

```bash
git add src/background/messages.ts src/background/messages.test.ts src/background/index.ts src/content/SidePanel.tsx src/content/SidePanel.test.tsx src/content/index.tsx
git commit -m "feat(content): wire 7-day momentum sparkline (snapshot:history + panel)"
```

---

## Self-Review notes

- **Spec coverage:** KvStore.remove for history cleanup (Task 1); favourites pure ops + 20-cap (Task 2); favourites service incl. history deletion on un-favourite (Task 3); favourites message routing (Task 4); star toggle + cap hint UI (Task 5); content/background favourites wiring (Task 6); snapshot-history pure lib — utcDay/isSnapshotDue/appendDay (Task 7); snapshot service — fetch-once, absent→0/null, lastDate advance, history getter (Task 8); alarms + startup catch-up + manifest `alarms` permission (Task 9); sparkline points pure lib (Task 10); SparklineSection states (Task 11); snapshot:history message + panel section + content wiring + manual verification (Task 12). All design sections (§2–§7) covered.
- **Type consistency:** `Favourite = { isin; ticker }`, `DailySnapshot = { date; mentions; rank: number|null }`, `FAVOURITES_CAP`, `hasFavourite`/`toggleFavourite`, `createFavouritesService` (`get`/`has`/`toggle`), `createSnapshotService(store, getFavourites, fetchSnapshot)` with `runIfDue`/`history`, `sparklinePoints(values, width, height)`, message types `favourites:toggle`/`favourites:has`/`snapshot:history`, handler names `toggleFavourite`/`isFavourite`/`getSnapshotHistory`, and SidePanel props `isFavourite`/`showCapHint`/`onToggleFavourite`/`history` are identical across all tasks.
- **Storage keys:** `favourites`, `snapshot:lastDate`, `snapshot:history:<isin>` — used identically in favourites-service, snapshot-service, and tests.
- **Cap feedback:** the service no-ops an add at 20 and returns `false`; the content layer infers the cap from "attempted add (`!wasFavourite`) but still not favourite" and sets `showCapHint`.
- **Scope honored:** no export UI, no favourites-management screen, snapshot stays Apewisdom-only — all deferred per the design.
```

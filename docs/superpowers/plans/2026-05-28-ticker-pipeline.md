# ISIN → Ticker Pipeline (Build Step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the active ISIN to a US-Ticker via OpenFIGI's free `/v3/mapping` endpoint, cache the mapping permanently in `browser.storage.local`, and show the ticker in the Badge under the ISIN. ISINs without a US-Ticker mapping (ETFs, German-only listings) render the Badge with the ISIN only — the "Uncovered" copy comes later.

**Architecture:**
- Pure HTTP adapter (`fetchTickerFromOpenFigi`) takes an injectable `fetch` so it tests without network.
- A tiny `KvStore` interface (`get`/`set`) lets `createTickerCache` work against either `browser.storage.local` in production or an in-memory object in tests.
- The cache is read-through: hit → return immediately; miss → call adapter, persist result (including `null` to remember "looked up, no mapping"), return.
- The content script subscribes to `observeIsin` as before; on each ISIN change it kicks off `cache.get(isin)` and re-renders the Badge with the resolved ticker (or `null` while pending / for uncovered assets). Races (user navigates Asset A → B → A faster than fetches resolve) are handled by ignoring stale responses via a per-subscription generation counter.

**Tech Stack:** No new deps. Uses `fetch` (available in Firefox MV3 content scripts) and `browser.storage.local`.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `src/lib/openfigi.ts` | `fetchTickerFromOpenFigi(isin, fetchFn) → Promise<string \| null>` |
| `src/lib/openfigi.test.ts` | Vitest with `fetch` stubs |
| `src/lib/kv-store.ts` | `KvStore` interface + `browserStorageKvStore(area)` adapter for `browser.storage.local` |
| `src/lib/kv-store.test.ts` | Only the in-memory test helper; `browserStorageKvStore` is a 5-line wrapper, no test |
| `src/lib/ticker-cache.ts` | `createTickerCache(store, fetchTicker) → { get(isin) }` read-through cache |
| `src/lib/ticker-cache.test.ts` | Vitest using in-memory KvStore + fake fetcher |
| `src/content/Badge.tsx` | Modified: optional `ticker` prop rendered under ISIN |
| `src/content/Badge.test.tsx` | Modified: cover with-ticker and without-ticker cases |
| `src/content/badge.css` | Modified: style for `.ape-intel-badge__ticker` |
| `src/content/index.tsx` | Modified: wire `browser.storage.local` + adapter into cache, re-render Badge on resolved ticker, drop stale results |
| `manifest.config.ts` | Modified: add `storage` permission and `https://api.openfigi.com/*` host_permission |

---

## OpenFIGI request/response shape

Request: `POST https://api.openfigi.com/v3/mapping` with JSON body:

```json
[{ "idType": "ID_ISIN", "idValue": "<ISIN>", "exchCode": "US" }]
```

(`exchCode: "US"` restricts to US-listed instruments. For an ISIN with no US listing OpenFIGI returns a `warning`, which we map to `null` — the correct "Uncovered" signal per PRD §6 F2.)

Successful response (one entry per request item):

```json
[
  {
    "data": [
      { "ticker": "AAPL", "name": "APPLE INC", "exchCode": "US", "compositeFIGI": "BBG000B9XRY4", "...": "..." }
    ]
  }
]
```

No-mapping response:

```json
[ { "warning": "No identifier found." } ]
```

Behaviour:
- Pick `data[0].ticker` when `data` is a non-empty array.
- Return `null` when `warning` is present or `data` is missing/empty.
- Throw on non-2xx HTTP (network failures bubble to caller; the cache wraps and falls back to "no ticker, don't persist").

---

## Task 1: OpenFIGI adapter with TDD

**Files:**
- Create: `src/lib/openfigi.ts`
- Create: `src/lib/openfigi.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchTickerFromOpenFigi } from "./openfigi";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

describe("fetchTickerFromOpenFigi", () => {
  it("posts to the OpenFIGI mapping endpoint with ID_ISIN + US exchCode", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ data: [{ ticker: "AAPL" }] }]));
    await fetchTickerFromOpenFigi("US0378331005", fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.openfigi.com/v3/mapping");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual([
      { idType: "ID_ISIN", idValue: "US0378331005", exchCode: "US" },
    ]);
  });

  it("returns the ticker from a successful mapping", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ data: [{ ticker: "AAPL" }] }]));
    expect(await fetchTickerFromOpenFigi("US0378331005", fetchFn)).toBe("AAPL");
  });

  it("returns null when OpenFIGI warns no identifier found", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ warning: "No identifier found." }]));
    expect(await fetchTickerFromOpenFigi("DE0007164600", fetchFn)).toBeNull();
  });

  it("returns null when data is empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([{ data: [] }]));
    expect(await fetchTickerFromOpenFigi("XX0000000000", fetchFn)).toBeNull();
  });

  it("throws on non-2xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    await expect(
      fetchTickerFromOpenFigi("US0378331005", fetchFn),
    ).rejects.toThrow(/429/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

`npx vitest run src/lib/openfigi.test.ts`

- [ ] **Step 3: Implement `src/lib/openfigi.ts`**

```ts
const ENDPOINT = "https://api.openfigi.com/v3/mapping";

interface OpenFigiResponseItem {
  data?: Array<{ ticker?: string }>;
  warning?: string;
}

export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchTickerFromOpenFigi(
  isin: string,
  fetchFn: FetchFn,
): Promise<string | null> {
  const response = await fetchFn(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { idType: "ID_ISIN", idValue: isin, exchCode: "US" },
    ]),
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI returned ${response.status}`);
  }

  const payload = (await response.json()) as OpenFigiResponseItem[];
  const first = payload[0];
  const ticker = first?.data?.[0]?.ticker;
  return ticker ?? null;
}
```

- [ ] **Step 4: Run tests — expect 5/5 pass**

- [ ] **Step 5: Typecheck**

`npm run typecheck`

- [ ] **Step 6: Commit**

```
git add src/lib/openfigi.ts src/lib/openfigi.test.ts
git commit -m "feat(lib): openfigi adapter — isin to us ticker"
```

---

## Task 2: KvStore interface + browser.storage.local adapter

**Files:**
- Create: `src/lib/kv-store.ts`
- Create: `src/lib/kv-store.test.ts`

The interface is intentionally tiny — `get`/`set`. No bulk ops, no namespacing — the cache module will namespace its own keys (`ticker:<isin>`).

- [ ] **Step 1: Write the failing tests**

`src/lib/kv-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInMemoryKvStore } from "./kv-store";

describe("createInMemoryKvStore", () => {
  it("returns undefined for an unset key", async () => {
    const store = createInMemoryKvStore();
    expect(await store.get("missing")).toBeUndefined();
  });

  it("returns what was set", async () => {
    const store = createInMemoryKvStore();
    await store.set("k", "v");
    expect(await store.get("k")).toBe("v");
  });

  it("distinguishes a stored null from an unset key", async () => {
    const store = createInMemoryKvStore();
    await store.set("k", null);
    expect(await store.get("k")).toBeNull();
  });

  it("overwrites on second set", async () => {
    const store = createInMemoryKvStore();
    await store.set("k", "a");
    await store.set("k", "b");
    expect(await store.get("k")).toBe("b");
  });

  it("seeds from an initial map", async () => {
    const store = createInMemoryKvStore({ x: 1, y: null });
    expect(await store.get("x")).toBe(1);
    expect(await store.get("y")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `src/lib/kv-store.ts`**

```ts
export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
}

export function createInMemoryKvStore(
  seed: Record<string, unknown> = {},
): KvStore {
  const data = new Map<string, unknown>(Object.entries(seed));
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return data.has(key) ? (data.get(key) as T) : undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, value);
    },
  };
}

interface BrowserStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function browserStorageKvStore(area: BrowserStorageArea): KvStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const result = await area.get(key);
      return key in result ? (result[key] as T) : undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await area.set({ [key]: value });
    },
  };
}
```

Rationale for the `BrowserStorageArea` interface: avoids depending on `@types/firefox-webext-browser`'s `browser.storage.StorageArea` shape directly so the lib stays platform-agnostic and trivially mockable. The content script will pass `browser.storage.local`, which structurally satisfies the interface.

- [ ] **Step 4: Run tests — expect 5/5 pass**

- [ ] **Step 5: Typecheck**

- [ ] **Step 6: Commit**

```
git add src/lib/kv-store.ts src/lib/kv-store.test.ts
git commit -m "feat(lib): kv-store interface + in-memory + browser-storage adapters"
```

---

## Task 3: Read-through ticker cache

**Files:**
- Create: `src/lib/ticker-cache.ts`
- Create: `src/lib/ticker-cache.test.ts`

Behaviour:
- Key format: `ticker:<ISIN>`. Stored value: `string | null` (null encodes "we looked it up, no US ticker mapping").
- `get(isin)`: read key from store. If present (even `null`), return it. If missing, call the fetcher, persist the result, return.
- If the fetcher throws, do NOT persist. Re-throw to the caller. (Transient network errors should not poison the cache.)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "./kv-store";
import { createTickerCache } from "./ticker-cache";

describe("createTickerCache", () => {
  it("calls the fetcher and returns the ticker on cache miss", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("AAPL");
    const cache = createTickerCache(store, fetcher);

    expect(await cache.get("US0378331005")).toBe("AAPL");
    expect(fetcher).toHaveBeenCalledWith("US0378331005");
  });

  it("persists the resolved ticker under ticker:<isin>", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("AAPL");
    const cache = createTickerCache(store, fetcher);
    await cache.get("US0378331005");

    expect(await store.get("ticker:US0378331005")).toBe("AAPL");
  });

  it("returns the cached ticker without calling the fetcher again", async () => {
    const store = createInMemoryKvStore({ "ticker:US0378331005": "AAPL" });
    const fetcher = vi.fn();
    const cache = createTickerCache(store, fetcher);

    expect(await cache.get("US0378331005")).toBe("AAPL");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caches a null result and returns it without re-fetching", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue(null);
    const cache = createTickerCache(store, fetcher);

    expect(await cache.get("DE0007164600")).toBeNull();
    expect(await cache.get("DE0007164600")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not persist when the fetcher throws", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const cache = createTickerCache(store, fetcher);

    await expect(cache.get("US0378331005")).rejects.toThrow("network down");
    expect(await store.get("ticker:US0378331005")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `src/lib/ticker-cache.ts`**

```ts
import type { KvStore } from "./kv-store";

export type TickerFetcher = (isin: string) => Promise<string | null>;

export interface TickerCache {
  get(isin: string): Promise<string | null>;
}

const keyOf = (isin: string): string => `ticker:${isin}`;

export function createTickerCache(
  store: KvStore,
  fetcher: TickerFetcher,
): TickerCache {
  return {
    async get(isin: string): Promise<string | null> {
      const cached = await store.get<string | null>(keyOf(isin));
      if (cached !== undefined) return cached;

      const fresh = await fetcher(isin);
      await store.set(keyOf(isin), fresh);
      return fresh;
    },
  };
}
```

- [ ] **Step 4: Run tests — expect 5/5 pass**

- [ ] **Step 5: Typecheck**

- [ ] **Step 6: Commit**

```
git add src/lib/ticker-cache.ts src/lib/ticker-cache.test.ts
git commit -m "feat(lib): read-through ticker cache"
```

---

## Task 4: Render ticker in Badge

**Files:**
- Modify: `src/content/Badge.tsx`
- Modify: `src/content/badge.css`
- Modify: `src/content/Badge.test.tsx`

The Badge gains an optional `ticker?: string | null` prop. When a string, render it under the ISIN. When `null` or `undefined`, render nothing extra (the Badge is identical to its current form). This matches both "still resolving" and "Uncovered" — distinct copy waits for Step 8.

- [ ] **Step 1: Extend `Badge.test.tsx`** — replace the file with:

```tsx
import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("<Badge />", () => {
  it("renders the ISIN it was given", () => {
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

  it("omits the ticker element when ticker is undefined", () => {
    const { container } = render(<Badge isin="US0378331005" />);
    expect(container.querySelector(".ape-intel-badge__ticker")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect 3 fail** (the three new ticker cases — the old two should still pass)

`npx vitest run src/content/Badge.test.tsx`

- [ ] **Step 3: Update `Badge.tsx`**

```tsx
import "./badge.css";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
}

export function Badge({ isin, ticker }: BadgeProps) {
  return (
    <div class="ape-intel-badge" role="status" aria-label="Ape Intel">
      <span class="ape-intel-badge__brand">Ape Intel</span>
      <span class="ape-intel-badge__isin">{isin}</span>
      {ticker ? (
        <span class="ape-intel-badge__ticker">{ticker}</span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Extend `badge.css`** — append the new selector after the existing rules:

```css
.ape-intel-badge__ticker {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  font-size: 14px;
  color: #4ade80;
}
```

- [ ] **Step 5: Run tests — expect 5/5 pass**

- [ ] **Step 6: Typecheck + full suite**

`npm run typecheck && npm test` — exit 0; 31 tests total (18 prior + 5 openfigi + 5 kv-store + 5 ticker-cache + 3 new Badge = wait, the existing 2 Badge tests are preserved so it's 18 + 5 + 5 + 5 + 3 = 36. Let me recount: 10 isin + 6 url-observer + 5 openfigi + 5 kv-store + 5 ticker-cache + 5 Badge = 36).

- [ ] **Step 7: Commit**

```
git add src/content/Badge.tsx src/content/badge.css src/content/Badge.test.tsx
git commit -m "feat(content): render ticker under isin in badge"
```

---

## Task 5: Manifest permissions

**Files:**
- Modify: `manifest.config.ts`

- [ ] **Step 1: Add `permissions` and `host_permissions` arrays.** Replace the `content_scripts` block with the new fields preceding it (keep existing fields untouched):

The new manifest config should read:

```ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ape Intel",
  version: "0.0.3",
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
  host_permissions: ["https://api.openfigi.com/*"],
  content_scripts: [
    {
      matches: ["https://de.scalable.capital/broker/security*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
});
```

(Version bumped to `0.0.3` since this Step is the next tag.)

- [ ] **Step 2: Typecheck + build**

`npm run typecheck && npm run build` — exit 0.

- [ ] **Step 3: Commit**

```
git add manifest.config.ts
git commit -m "feat(manifest): storage + openfigi host permission, bump 0.0.3"
```

---

## Task 6: Wire cache into content script

**Files:**
- Modify: `src/content/index.tsx`

- [ ] **Step 1: Replace `src/content/index.tsx`**

```tsx
import { render } from "preact";
import { Badge } from "./Badge";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import { fetchTickerFromOpenFigi } from "../lib/openfigi";

const HOST_ID = "ape-intel-host";

const tickerCache = createTickerCache(
  browserStorageKvStore(browser.storage.local),
  (isin) => fetchTickerFromOpenFigi(isin, fetch),
);

function ensureHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

function renderBadge(isin: string, ticker: string | null | undefined): void {
  render(<Badge isin={isin} ticker={ticker} />, ensureHost());
}

function unmount(): void {
  const host = document.getElementById(HOST_ID);
  if (host) render(null, host);
}

let generation = 0;

observeIsin(window, (isin) => {
  generation += 1;
  const requestGeneration = generation;

  if (!isin) {
    unmount();
    return;
  }

  renderBadge(isin, undefined);

  tickerCache.get(isin).then(
    (ticker) => {
      if (requestGeneration !== generation) return;
      renderBadge(isin, ticker);
    },
    (error) => {
      if (requestGeneration !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", error);
    },
  );
});
```

Why the generation counter: the user can switch from Asset A → B before A's `fetchTickerFromOpenFigi` resolves. Without it, the late A response would overwrite B's Badge.

The `console.warn` on lookup failure is the only logging in this step. The structured logger arrives in Step 8.

- [ ] **Step 2: Typecheck + tests + build**

`npm run typecheck && npm test && npm run build` — exit 0; 36 tests pass; dist regenerated.

- [ ] **Step 3: Commit**

```
git add src/content/index.tsx
git commit -m "feat(content): resolve ticker via openfigi cache and pass to badge"
```

---

## Task 7: Manual Firefox verification

Interactive — cannot be subagent-executed.

- [ ] **Step 1: Reload extension**

`about:debugging#/runtime/this-firefox` → Ape Intel **Reload** (or remove + re-load `dist/manifest.json`). Version should now read `0.0.3`.

- [ ] **Step 2: Cold-load on a US stock**

Open `https://de.scalable.capital/broker/security?isin=US0378331005`. First request hits OpenFIGI. Within ~1s the Badge should show:

```
APE INTEL
US0378331005
AAPL
```

Open the browser devtools Network tab to confirm a single `POST https://api.openfigi.com/v3/mapping` call.

- [ ] **Step 3: Reload — confirm cache hit (no network call)**

Hard-reload the same page. The Badge should show AAPL immediately. The Network tab should show NO request to api.openfigi.com.

- [ ] **Step 4: Navigate via SPA to a German-only listing**

Search for a DAX stock with no US listing (e.g. Volkswagen AG `DE0007664039` or whatever Scalable surfaces first). Badge should show the ISIN; the ticker line should NOT appear (OpenFIGI returns "no identifier" because we ask for `exchCode: "US"`). One OpenFIGI request the first time; cache hit thereafter.

- [ ] **Step 5: Race check**

From a security page, rapidly navigate Asset A → B → A via Scalable's search. The Badge that finally settles must show the ticker for the **last** asset clicked, not whichever fetch happened to resolve last.

- [ ] **Step 6: Inspect storage**

Devtools → Storage → Extension Storage → `ape-intel@lmueller.dev` → `local`. Confirm keys like `ticker:US0378331005 = "AAPL"` and `ticker:DE... = null`.

- [ ] **Step 7: Tag**

```bash
git tag -a v0.0.3-ticker -m "Step 2: openfigi isin->ticker pipeline with permanent cache"
```

---

## Done criteria

- 36 tests pass.
- `npm run typecheck` and `npm run build` exit 0.
- Loaded in Firefox: AAPL shows under US0378331005; cache hit on reload (no network call); German-only ISINs render without a ticker line; storage view confirms persistent `ticker:<isin>` entries; rapid navigation does not show stale tickers.
- Tag `v0.0.3-ticker` on `main`.

## Out of scope (deferred)

- Showing "Uncovered" copy or distinguishing "still resolving" from "no ticker" — Step 8 polish.
- Apewisdom + sentiment data — Step 3.
- Side Panel — first appears in Step 3.
- Logger — Step 8.
- Rate-limit handling beyond bubbling the HTTP error — when we cross OpenFIGI's 25 req/min unauthenticated cap. Cache shields us from the common case; revisit if it bites in practice.

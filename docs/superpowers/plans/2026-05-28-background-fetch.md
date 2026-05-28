# Background-Script Fetch Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the OpenFIGI fetch out of the content script (which is subject to page CORS) into a background script (which gets the CORS bypass for hosts in `host_permissions`). The Badge then actually shows the ticker.

**Architecture:** A background script registers a `runtime.onMessage` handler that dispatches `{ type: "ticker:lookup", isin }` to `fetchTickerFromOpenFigi`. The content script replaces its direct fetch with a thin `sendMessage` wrapper. The `TickerFetcher` shape is unchanged, so the cache and Badge are untouched. The message handler dispatch is testable as a pure function.

**Tech Stack:** Firefox MV3 background scripts (NOT service_worker — Firefox MV3 supports `background.scripts`). `browser.runtime.sendMessage` / `onMessage`.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `src/background/messages.ts` | Pure message type + `handleMessage(message, fetchTicker)` dispatcher |
| `src/background/messages.test.ts` | Vitest |
| `src/background/index.ts` | Background entry: wires `browser.runtime.onMessage` to `handleMessage` |
| `src/content/index.tsx` | Modified: TickerFetcher now `sendMessage`-based, not direct fetch |
| `manifest.config.ts` | Add `background: { scripts: ["src/background/index.ts"] }`, bump 0.0.4 |

---

## Task 1: Message handler (pure) with TDD

**Files:**
- Create: `src/background/messages.ts`
- Create: `src/background/messages.test.ts`

### Behaviour
- Exports `TickerLookupMessage = { type: "ticker:lookup"; isin: string }`.
- `handleMessage(message, fetchTicker)` returns:
  - `Promise<string | null>` when message is a TickerLookupMessage (delegates to fetchTicker).
  - `undefined` for unknown messages — Firefox treats `undefined` as "I'm not handling this" and lets other listeners respond.

### Steps

- [ ] **Step 1: Tests** — `src/background/messages.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { handleMessage } from "./messages";

describe("handleMessage", () => {
  it("delegates ticker:lookup to fetchTicker and returns its promise", async () => {
    const fetchTicker = vi.fn().mockResolvedValue("AAPL");
    const result = handleMessage(
      { type: "ticker:lookup", isin: "US0378331005" },
      fetchTicker,
    );

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe("AAPL");
    expect(fetchTicker).toHaveBeenCalledWith("US0378331005");
  });

  it("propagates fetcher rejections", async () => {
    const fetchTicker = vi.fn().mockRejectedValue(new Error("OpenFIGI returned 429"));
    await expect(
      handleMessage({ type: "ticker:lookup", isin: "US0378331005" }, fetchTicker),
    ).rejects.toThrow("429");
  });

  it("returns undefined for unknown message types", () => {
    const fetchTicker = vi.fn();
    expect(handleMessage({ type: "something:else" }, fetchTicker)).toBeUndefined();
    expect(fetchTicker).not.toHaveBeenCalled();
  });

  it("returns undefined for non-object / nullish messages", () => {
    const fetchTicker = vi.fn();
    expect(handleMessage(null, fetchTicker)).toBeUndefined();
    expect(handleMessage("hello", fetchTicker)).toBeUndefined();
    expect(handleMessage(undefined, fetchTicker)).toBeUndefined();
    expect(fetchTicker).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — FAIL.**

`npx vitest run src/background/messages.test.ts`

- [ ] **Step 3: Implement `src/background/messages.ts`**

```ts
import type { TickerFetcher } from "../lib/ticker-cache";

export interface TickerLookupMessage {
  type: "ticker:lookup";
  isin: string;
}

function isTickerLookup(value: unknown): value is TickerLookupMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "ticker:lookup" &&
    typeof (value as { isin?: unknown }).isin === "string"
  );
}

export function handleMessage(
  message: unknown,
  fetchTicker: TickerFetcher,
): Promise<string | null> | undefined {
  if (!isTickerLookup(message)) return undefined;
  return fetchTicker(message.isin);
}
```

- [ ] **Step 4: Run tests — expect 4/4 pass.**

- [ ] **Step 5: Typecheck**

`npm run typecheck`

- [ ] **Step 6: Commit**

```
git add src/background/messages.ts src/background/messages.test.ts
git commit -m "feat(background): message dispatcher for ticker lookup"
```

---

## Task 2: Background entry script

**Files:**
- Create: `src/background/index.ts`

- [ ] **Step 1: Implement `src/background/index.ts`**

```ts
import { fetchTickerFromOpenFigi } from "../lib/openfigi";
import { handleMessage } from "./messages";

browser.runtime.onMessage.addListener((message) =>
  handleMessage(message, (isin) => fetchTickerFromOpenFigi(isin, fetch)),
);
```

That's it — the entry script is glue. The branching logic lives in `handleMessage` (tested in Task 1).

- [ ] **Step 2: Typecheck.** No new tests (3-line glue file).

- [ ] **Step 3: Commit**

```
git add src/background/index.ts
git commit -m "feat(background): entry wiring openfigi fetch to runtime messages"
```

---

## Task 3: Manifest — register background, bump version

**Files:**
- Modify: `manifest.config.ts`

- [ ] **Step 1: Replace `manifest.config.ts`** with:

```ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ape Intel",
  version: "0.0.4",
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

- [ ] **Step 2: `npm run typecheck && npm run build` — exit 0.** Verify `dist/manifest.json` contains the `background` block and version 0.0.4.

- [ ] **Step 3: Commit**

```
git add manifest.config.ts
git commit -m "feat(manifest): register background script, bump 0.0.4"
```

---

## Task 4: Content script — send via runtime instead of fetching directly

**Files:**
- Modify: `src/content/index.tsx`

The only change is the `TickerFetcher` injection passed to `createTickerCache`. Everything else (host management, generation counter, error path) stays.

- [ ] **Step 1: Replace `src/content/index.tsx`** with:

```tsx
import { render } from "preact";
import { Badge } from "./Badge";
import { observeIsin } from "../lib/url-observer";
import { browserStorageKvStore } from "../lib/kv-store";
import { createTickerCache } from "../lib/ticker-cache";
import type { TickerLookupMessage } from "../background/messages";

const HOST_ID = "ape-intel-host";

async function lookupTickerViaBackground(isin: string): Promise<string | null> {
  const message: TickerLookupMessage = { type: "ticker:lookup", isin };
  return (await browser.runtime.sendMessage(message)) as string | null;
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

- [ ] **Step 2: typecheck + tests + build**

`npm run typecheck && npm test && npm run build` — exit 0; 40 tests pass (36 prior + 4 messages); dist regenerated.

- [ ] **Step 3: Commit**

```
git add src/content/index.tsx
git commit -m "feat(content): proxy ticker lookup via background script (cors-safe)"
```

---

## Task 5: Manual Firefox verification

Interactive — same checklist as the Step 2 verification, but now with a real network call.

- [ ] **Step 1: REMOVE the Ape Intel temporary add-on, then Load Temporary Add-on… again** on the fresh `dist/manifest.json`. (Reload alone may not re-register the background script.)

- [ ] **Step 2:** version should read 0.0.4 in `about:debugging`.

- [ ] **Step 3:** Click **Inspect** on Ape Intel → DevTools attaches to the background script context. Console should be empty / no red.

- [ ] **Step 4:** Open `https://de.scalable.capital/broker/security?isin=US0378331005`. Within ~1s the Badge shows `APE INTEL / US0378331005 / AAPL`.

- [ ] **Step 5:** In the background script DevTools, **Network** tab should show one successful POST to `api.openfigi.com/v3/mapping` (200, with a readable response). NO CORS error.

- [ ] **Step 6:** Hard-reload page → AAPL appears immediately, no new network call.

- [ ] **Step 7:** Storage Inspector in the extension DevTools → Storage → Extension Storage → `local` → `ticker:US0378331005 = "AAPL"`.

- [ ] **Step 8:** Try a German-only listing → Badge shows ISIN without ticker line; cache stores `null`.

- [ ] **Step 9:** Tag

```bash
git tag -a v0.0.4-bg-fetch -m "fix: move openfigi fetch to background (cors)"
```

---

## Done criteria

- 40 tests pass.
- typecheck + build exit 0.
- Firefox: ticker actually renders; one OpenFIGI request per ISIN, no CORS errors, cache hits on reload.
- Tag `v0.0.4-bg-fetch` on `main`.

## Notes for future steps

- Step 3 (Apewisdom + Side Panel) will likely add more network calls — those should all go through the background script. We may grow `handleMessage` into a discriminated union dispatcher per source. The current shape is easy to extend.
- `browser.runtime.sendMessage` from a content script delivers to the background's `onMessage`. Errors thrown in the background propagate back as rejected promises in the content — our existing reject branch already logs them.

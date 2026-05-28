# TradingView Overlay + Quiver URL fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Clicking the TradingView button opens a fullscreen modal overlay inside the page with the TradingView Advanced Chart embedded for the current ticker. Esc/× closes it. Quiver URL bug fixed (`/stock/` not `/stocks/`). Tag v0.0.9.

**Architecture:**
- New `ChartOverlay` Preact component: fixed-position fullscreen, dark scrim, iframe pointing at TradingView's `widgetembed` URL, close button + Esc handler + click-on-scrim-to-close.
- `ExternalLinksBar` TradingView item becomes a `<button>` that calls an `onTradingViewClick` prop. Quiver stays an anchor.
- Content script holds new module-scope `isChartOpen` boolean, mounts `ChartOverlay` alongside Badge + SidePanel.

**CSP risk:** Scalable's page may use a strict `frame-src` Content Security Policy that blocks iframes from `tradingview.com`. If so the iframe will fail to load and we will see a CSP error in the page console. Fallback (deferred to a follow-up if it happens): open as a `browser.windows.create({type:"popup"})` from the background instead. This plan tries iframe first because it's the experience the user asked for — embedded, not a separate window.

**Tech Stack:** No new deps. Embedded TradingView widget URL:
`https://s.tradingview.com/widgetembed/?symbol={TICKER}&interval=D&theme=dark&style=1&locale=en&hideideas=1&withdateranges=1`

---

## File structure

| Path | Responsibility |
|------|----------------|
| `src/content/ChartOverlay.tsx` | Fullscreen modal with TradingView iframe |
| `src/content/ChartOverlay.test.tsx` | Vitest |
| `src/content/ExternalLinksBar.tsx` | TradingView becomes button; Quiver URL `/stock/` |
| `src/content/ExternalLinksBar.test.tsx` | Updated assertions |
| `src/content/sidePanel.css` | Add overlay styles |
| `src/content/index.tsx` | `isChartOpen` state + mount overlay |
| `manifest.config.ts` | Bump 0.0.9 |

No new host_permissions needed — iframes don't require them; the page CSP governs frame loading.

---

## Task 1: ChartOverlay component (TDD)

**Files:** Create `src/content/ChartOverlay.tsx`, `src/content/ChartOverlay.test.tsx`.

- [ ] **Step 1: Tests**

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartOverlay } from "./ChartOverlay";

afterEach(cleanup);

describe("<ChartOverlay />", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<ChartOverlay isOpen={false} ticker="AAPL" onClose={() => {}} />);
    expect(container.querySelector(".ape-intel-chart")).toBeNull();
  });

  it("renders nothing when ticker is null", () => {
    const { container } = render(<ChartOverlay isOpen ticker={null} onClose={() => {}} />);
    expect(container.querySelector(".ape-intel-chart")).toBeNull();
  });

  it("renders an iframe pointing at TradingView with the ticker substituted", () => {
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={() => {}} />);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain("https://s.tradingview.com/widgetembed/");
    expect(iframe.src).toContain("symbol=AAPL");
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-chart__close")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the scrim (not the iframe area) is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-chart")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT invoke onClose when the iframe area itself is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-chart__inner")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("invokes onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ChartOverlay isOpen ticker="AAPL" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Escape when closed", () => {
    const onClose = vi.fn();
    render(<ChartOverlay isOpen={false} ticker="AAPL" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: red.**

- [ ] **Step 3: Implement `src/content/ChartOverlay.tsx`**

```tsx
import { useEffect } from "preact/hooks";

export interface ChartOverlayProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  onClose: () => void;
}

function tradingViewSrc(ticker: string): string {
  const params = new URLSearchParams({
    symbol: ticker,
    interval: "D",
    theme: "dark",
    style: "1",
    locale: "en",
    hideideas: "1",
    withdateranges: "1",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

export function ChartOverlay({ isOpen, ticker, onClose }: ChartOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticker) return null;

  return (
    <div
      class="ape-intel-chart"
      role="dialog"
      aria-label={`TradingView chart for ${ticker}`}
      aria-modal="true"
      onClick={onClose}
    >
      <div
        class="ape-intel-chart__inner"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          class="ape-intel-chart__close"
          aria-label="Close chart"
          onClick={onClose}
        >
          ×
        </button>
        <iframe
          class="ape-intel-chart__iframe"
          src={tradingViewSrc(ticker)}
          title={`TradingView chart for ${ticker}`}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: green 8/8.**
- [ ] **Step 5: typecheck.**

(No commit yet.)

---

## Task 2: CSS for overlay

**Files:** Modify `src/content/sidePanel.css`.

- [ ] **Step 1: Append**

```css
.ape-intel-chart {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ape-intel-chart__inner {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 1600px;
  background: #111;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}
.ape-intel-chart__iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.ape-intel-chart__close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  background: rgba(0, 0, 0, 0.5);
  color: #f3f3f3;
  border: none;
  font-size: 20px;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  cursor: pointer;
  line-height: 1;
}
.ape-intel-chart__close:hover {
  background: #4ade80;
  color: #111;
}
```

---

## Task 3: ExternalLinksBar — fix Quiver URL, TradingView becomes button

**Files:** Modify `src/content/ExternalLinksBar.tsx`, `src/content/ExternalLinksBar.test.tsx`.

- [ ] **Step 1: Update `src/content/ExternalLinksBar.tsx`** — replace entirely:

```tsx
export interface ExternalLinksBarProps {
  ticker: string | null | undefined;
  onTradingViewClick: () => void;
}

export function ExternalLinksBar({ ticker, onTradingViewClick }: ExternalLinksBarProps) {
  if (!ticker) return null;
  return (
    <nav class="ape-intel-links" aria-label="External tools for this ticker">
      <button
        type="button"
        class="ape-intel-links__item ape-intel-links__item--button"
        onClick={onTradingViewClick}
      >
        <span class="ape-intel-links__emoji" aria-hidden="true">📈</span>
        <span class="ape-intel-links__label">TradingView</span>
      </button>
      <a
        class="ape-intel-links__item"
        href={`https://www.quiverquant.com/stock/${ticker}/`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="ape-intel-links__emoji" aria-hidden="true">🏛</span>
        <span class="ape-intel-links__label">Quiver</span>
      </a>
    </nav>
  );
}
```

- [ ] **Step 2: Update `src/content/ExternalLinksBar.test.tsx`** — replace:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalLinksBar } from "./ExternalLinksBar";

afterEach(cleanup);

describe("<ExternalLinksBar />", () => {
  it("renders nothing when ticker is null", () => {
    const { container } = render(<ExternalLinksBar ticker={null} onTradingViewClick={() => {}} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("renders nothing when ticker is undefined", () => {
    const { container } = render(<ExternalLinksBar ticker={undefined} onTradingViewClick={() => {}} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("invokes onTradingViewClick when the TradingView button is clicked", () => {
    const onTradingViewClick = vi.fn();
    const { getByRole } = render(<ExternalLinksBar ticker="AAPL" onTradingViewClick={onTradingViewClick} />);
    fireEvent.click(getByRole("button", { name: /TradingView/i }));
    expect(onTradingViewClick).toHaveBeenCalledTimes(1);
  });

  it("renders a Quiver anchor with the corrected /stock/ path", () => {
    const { getByRole } = render(<ExternalLinksBar ticker="AAPL" onTradingViewClick={() => {}} />);
    const a = getByRole("link", { name: /Quiver/i }) as HTMLAnchorElement;
    expect(a.href).toBe("https://www.quiverquant.com/stock/AAPL/");
    expect(a.target).toBe("_blank");
    expect(a.rel).toContain("noopener");
    expect(a.rel).toContain("noreferrer");
  });
});
```

- [ ] **Step 3: green 4/4.**
- [ ] **Step 4: typecheck.** Will fail in `src/content/index.tsx` — `onTradingViewClick` not yet provided. Fix in Task 4.

---

## Task 4: Content script — chart overlay state + wiring

**Files:** Modify `src/content/index.tsx`.

- [ ] **Step 1: Update `src/content/index.tsx`** — add `ChartOverlay` import, `isChartOpen` module-scope boolean, render the overlay, pass `onTradingViewClick` to the bar via SidePanel.

Wait — `ExternalLinksBar` is rendered inside `SidePanel`. The handler needs to thread through. Add an `onTradingViewClick` prop to `SidePanel` and forward it.

First update `SidePanel.tsx` to accept and forward the prop:

```tsx
// In SidePanelProps:
  onTradingViewClick: () => void;

// In the render, change:
      <ExternalLinksBar ticker={ticker} onTradingViewClick={onTradingViewClick} />
```

And pass through in destructuring:
```tsx
export function SidePanel({
  isOpen, ticker, apewisdom, stocktwits, onClose, onTradingViewClick,
}: SidePanelProps) {
```

Also update `SidePanel.test.tsx` `defaults` to include `onTradingViewClick: () => {}` so existing tests still pass.

Then update `src/content/index.tsx`:

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
import type {
  ApewisdomLookupMessage,
  StockTwitsLookupMessage,
  TickerLookupMessage,
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
let isChartOpen = false;
let currentIsin: string | null = null;
let currentTicker: string | null | undefined = undefined;
let currentApewisdom: ApewisdomEntry | null | undefined = undefined;
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
        stocktwits={currentStockTwits}
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

let generation = 0;

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

observeIsin(window, (isin) => {
  generation += 1;
  const gen = generation;

  currentIsin = isin;
  currentTicker = undefined;
  currentApewisdom = undefined;
  currentStockTwits = undefined;
  isChartOpen = false; // close chart on navigation

  if (!isin) { paint(); return; }
  paint();

  tickerCache.get(isin).then(
    (ticker) => {
      if (gen !== generation) return;
      currentTicker = ticker;
      paint();
      if (ticker) dispatchSentimentLookups(ticker, gen);
      else {
        currentApewisdom = null;
        currentStockTwits = null;
        paint();
      }
    },
    (e) => {
      if (gen !== generation) return;
      console.warn("[ape-intel] ticker lookup failed", e);
      currentTicker = null;
      currentApewisdom = null;
      currentStockTwits = null;
      paint();
    },
  );
});
```

- [ ] **Step 2: typecheck + tests + build.** All exit 0. Test count: 81 prior - 4 old ExternalLinksBar + 4 new ExternalLinksBar + 8 new ChartOverlay = **89**.

---

## Task 5: Manifest — bump 0.0.9

**Files:** Modify `manifest.config.ts`.

- [ ] **Step 1: Bump version**

```ts
  version: "0.0.9",
```

Everything else stays. No host_permission needed for iframe loads.

- [ ] **Step 2: typecheck + build.** `dist/manifest.json` v0.0.9.

---

## Task 6: Single commit

```bash
git add src/content/ChartOverlay.tsx src/content/ChartOverlay.test.tsx \
        src/content/ExternalLinksBar.tsx src/content/ExternalLinksBar.test.tsx \
        src/content/SidePanel.tsx src/content/SidePanel.test.tsx \
        src/content/sidePanel.css \
        src/content/index.tsx \
        manifest.config.ts
git commit -m "feat(content): tradingview chart overlay; fix quiver url

- TradingView opens a fullscreen modal overlay with the Advanced Chart
  widget embedded as an iframe. Close via ×, Esc, or scrim click.
- Quiver URL corrected: /stock/ (singular), not /stocks/.
- Bump 0.0.9.

If Scalable's CSP blocks the tradingview.com iframe (frame-src
directive), the overlay will be visible but empty — fallback to a
browser.windows.create popup will land in a follow-up if so."
```

---

## Task 7: Manual Firefox verification

- [ ] Remove + Load Temporary Add-on on `dist/manifest.json`. Version 0.0.9.
- [ ] Open AAPL security page. Click Badge. Panel renders.
- [ ] Click **📈 TradingView** in the links bar:
  - **Expected**: fullscreen dark overlay with TradingView Advanced Chart for AAPL. × in the top-right of the chart, click outside (on the dark scrim) or press Esc closes it.
  - **If you see a dark scrim with an empty / blocked iframe in the page console** ("Content Security Policy: The page's settings blocked the loading of a resource at s.tradingview.com"): CSP is blocking us. Report back; we'll switch to a popup window.
- [ ] Click **🏛 Quiver**: new tab opens at `https://www.quiverquant.com/stock/AAPL/` (singular). Page loads correctly.
- [ ] With chart open, navigate to another security via Scalable's search — the chart should close (per the `isChartOpen = false` reset on navigation).
- [ ] Esc key closes the chart only when it's open.
- [ ] Tag

```bash
git tag -a v0.0.9-chart-overlay -m "tradingview chart overlay + quiver url fix"
```

---

## Done

- 89 tests pass.
- typecheck + build exit 0.
- Firefox: TradingView opens as fullscreen modal; Quiver URL fixed; Esc/scrim/× close.
- Tag `v0.0.9-chart-overlay` on `main`.

## CSP fallback (only if verification step 3 fails)

If the iframe is blocked:
- Add a background message `{type:"chart:open", ticker}` that calls `browser.windows.create({ url, type: "popup", width: 1400, height: 900 })` with a TradingView URL.
- Content script's `onTradingViewClick` sends that message instead of toggling `isChartOpen`.
- Remove `ChartOverlay` (or keep it disabled behind a feature flag for future revival).
- Bump 0.1.0.

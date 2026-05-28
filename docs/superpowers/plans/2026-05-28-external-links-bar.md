# External Links Bar + Tradestie pause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Hide the Tradestie section (keeping the adapter/service code dormant for revival during the future Trending view), and add a small links bar at the bottom of the Side Panel with one-click access to TradingView (chart + volume) and Quiver Quantitative (insider trades + alt-data) for the current ticker.

**Architecture:**
- SidePanel drops its Tradestie section and `tradestie` prop. Adapter, service, message route, background wiring all stay — pure dead-code-but-callable, easy revival.
- Content script stops dispatching `tradestie:lookup` and drops `currentTradestie` state. Background still routes the message — nobody sends it.
- New `ExternalLinksBar` renders a row of icon+label anchors with `target="_blank" rel="noopener noreferrer"`. URLs templated on the resolved ticker. Hidden when ticker is unknown/null.

**Tech Stack:** No new deps.

---

## URLs

- TradingView: `https://www.tradingview.com/chart/?symbol={TICKER}` — TradingView's symbol resolver picks the right exchange.
- Quiver: `https://www.quiverquant.com/stocks/{TICKER}/`

Both work for any US-listed ticker we resolve via OpenFIGI.

---

## Task 1: ExternalLinksBar component (TDD)

**Files:** Create `src/content/ExternalLinksBar.tsx`, `src/content/ExternalLinksBar.test.tsx`.

- [ ] **Step 1: Tests**

```tsx
import { render, cleanup } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { ExternalLinksBar } from "./ExternalLinksBar";

afterEach(cleanup);

describe("<ExternalLinksBar />", () => {
  it("renders nothing when ticker is null", () => {
    const { container } = render(<ExternalLinksBar ticker={null} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("renders nothing when ticker is undefined", () => {
    const { container } = render(<ExternalLinksBar ticker={undefined} />);
    expect(container.querySelector(".ape-intel-links")).toBeNull();
  });

  it("renders TradingView and Quiver links with the ticker substituted", () => {
    const { getByRole } = render(<ExternalLinksBar ticker="AAPL" />);
    const tv = getByRole("link", { name: /TradingView/i }) as HTMLAnchorElement;
    const quiver = getByRole("link", { name: /Quiver/i }) as HTMLAnchorElement;
    expect(tv.href).toBe("https://www.tradingview.com/chart/?symbol=AAPL");
    expect(quiver.href).toBe("https://www.quiverquant.com/stocks/AAPL/");
  });

  it("opens external links in a new tab safely", () => {
    const { getAllByRole } = render(<ExternalLinksBar ticker="AAPL" />);
    for (const a of getAllByRole("link") as HTMLAnchorElement[]) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toContain("noopener");
      expect(a.rel).toContain("noreferrer");
    }
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: Implement `src/content/ExternalLinksBar.tsx`**

```tsx
export interface ExternalLinksBarProps {
  ticker: string | null | undefined;
}

interface ExternalLink {
  href: (ticker: string) => string;
  label: string;
  emoji: string;
}

const LINKS: ExternalLink[] = [
  {
    label: "TradingView",
    emoji: "📈",
    href: (t) => `https://www.tradingview.com/chart/?symbol=${t}`,
  },
  {
    label: "Quiver",
    emoji: "🏛",
    href: (t) => `https://www.quiverquant.com/stocks/${t}/`,
  },
];

export function ExternalLinksBar({ ticker }: ExternalLinksBarProps) {
  if (!ticker) return null;
  return (
    <nav class="ape-intel-links" aria-label="External tools for this ticker">
      {LINKS.map((link) => (
        <a
          key={link.label}
          class="ape-intel-links__item"
          href={link.href(ticker)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="ape-intel-links__emoji" aria-hidden="true">{link.emoji}</span>
          <span class="ape-intel-links__label">{link.label}</span>
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: green 4/4.**
- [ ] **Step 5: typecheck.**

(No commit yet — bundled with the SidePanel change in Task 3.)

---

## Task 2: CSS for the links bar

**Files:** Modify `src/content/sidePanel.css`.

- [ ] **Step 1: Append to `sidePanel.css`**

```css
.ape-intel-links {
  border-top: 1px solid #2a2a2a;
  padding-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ape-intel-links__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #1a1a1a;
  color: inherit;
  text-decoration: none;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s;
}
.ape-intel-links__item:hover {
  background: #232323;
  color: #4ade80;
}
.ape-intel-links__emoji {
  font-size: 14px;
  line-height: 1;
}
```

(Append at end; do not touch existing rules.)

(No commit yet.)

---

## Task 3: SidePanel — drop Tradestie section, add links bar

**Files:** Modify `src/content/SidePanel.tsx`, `src/content/SidePanel.test.tsx`.

- [ ] **Step 1: Update `src/content/SidePanel.tsx`**

Remove the `tradestie` prop, remove `TradestieSection` function entirely, remove the `tradestie` import and use, remove `<TradestieSection entry={tradestie} />` from the render, add `<ExternalLinksBar ticker={ticker} />` as the last child of the `<aside>`. Add the import.

Resulting file:

```tsx
import "./sidePanel.css";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { ExternalLinksBar } from "./ExternalLinksBar";

export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
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
      <h3 class="ape-intel-panel__section-title">Apewisdom (Buzz + Trend)</h3>
      {entry === undefined ? <Placeholder>Loading…</Placeholder>
      : entry === null ? <Placeholder>No Apewisdom data — ticker not in current top 250 trending.</Placeholder>
      : (
        <dl class="ape-intel-panel__stats ape-intel-panel__stats--two">
          <div>
            <dt>Mentions</dt>
            <dd>{entry.mentions}{" "}<span class="ape-intel-panel__trend">{trendArrow(entry.mentions, entry.mentions24hAgo)}</span></dd>
          </div>
          <div><dt>Rank</dt><dd>#{entry.rank}</dd></div>
        </dl>
      )}
    </section>
  );
}

export function SidePanel({
  isOpen, ticker, apewisdom, stocktwits, onClose,
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
      <ExternalLinksBar ticker={ticker} />
    </aside>
  );
}
```

- [ ] **Step 2: Update `src/content/SidePanel.test.tsx`**

Remove the `tradestie` import, helper, fixture in `defaults`, the two Tradestie-specific tests ("renders Tradestie comments + sentiment label", "Tradestie shows no-data placeholder when null"), and `tradestie` from the no-data tests' overrides. Keep everything else.

Specifically:
- Drop `import type { TradestieEntry } from "../lib/tradestie";`
- Drop the `tradestie` helper.
- Drop `tradestie` from `defaults`.
- Drop the two Tradestie tests.
- Update the "shows a resolving message" test to not pass `tradestie={undefined}` (it doesn't exist anymore).

Final file:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const apewisdom = (o: Partial<ApewisdomEntry> = {}): ApewisdomEntry => ({
  rank: 5, mentions: 247, mentions24hAgo: 180, ...o,
});
const stocktwits = (o: Partial<StockTwitsEntry> = {}): StockTwitsEntry => ({
  bullish: 18, bearish: 4, totalMessages: 30, ...o,
});

const defaults = {
  isOpen: true,
  ticker: "AAPL" as string | null | undefined,
  apewisdom: apewisdom() as ApewisdomEntry | null | undefined,
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
      <SidePanel {...defaults} ticker={undefined} apewisdom={undefined} stocktwits={undefined} />,
    );
    expect(getByText(/Resolving/i)).toBeTruthy();
  });

  it("renders StockTwits prominently with bullish/bearish counts and a ratio", () => {
    const { getByText, container } = render(<SidePanel {...defaults} stocktwits={stocktwits({ bullish: 18, bearish: 4 })} />);
    expect(container.querySelector(".ape-intel-panel__source--stocktwits")).toBeTruthy();
    expect(getByText(/18/)).toBeTruthy();
    expect(getByText(/4\b/)).toBeTruthy();
    expect(getByText(/82%/)).toBeTruthy();
  });

  it("StockTwits shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} stocktwits={null} />);
    expect(getByText(/No StockTwits data/i)).toBeTruthy();
  });

  it("renders Apewisdom mentions, rank, and trend arrow", () => {
    const { getByText } = render(<SidePanel {...defaults} apewisdom={apewisdom({ mentions: 247, mentions24hAgo: 180 })} />);
    expect(getByText(/247/)).toBeTruthy();
    expect(getByText(/#5/)).toBeTruthy();
    expect(getByText(/↑/)).toBeTruthy();
  });

  it("Apewisdom shows no-data placeholder when null", () => {
    const { getByText } = render(<SidePanel {...defaults} apewisdom={null} />);
    expect(getByText(/No Apewisdom data/i)).toBeTruthy();
  });

  it("invokes onClose when close button clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SidePanel {...defaults} onClose={onClose} />);
    fireEvent.click(container.querySelector(".ape-intel-panel__close")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: All SidePanel tests pass (8 tests).**
- [ ] **Step 4: typecheck.** (Will fail in `src/content/index.tsx` because the `tradestie` prop no longer exists — fix in Task 4.)

---

## Task 4: Content script — stop dispatching Tradestie

**Files:** Modify `src/content/index.tsx`.

- [ ] **Step 1: Remove** `TradestieEntry` import, `TradestieLookupMessage` import, `currentTradestie` variable, the Tradestie call inside `dispatchSentimentLookups`, the Tradestie reset/error-branch lines, and the `tradestie={currentTradestie}` prop on `<SidePanel />`.

Final file:

```tsx
import { render } from "preact";
import { Badge } from "./Badge";
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

- [ ] **Step 2: typecheck + tests + build.**

`npm run typecheck && npm test && npm run build` exit 0; test count = 79 prior - 2 dropped Tradestie + 4 new ExternalLinksBar = **81**.

---

## Task 5: Manifest — bump 0.0.8

**Files:** Modify `manifest.config.ts`.

- [ ] **Step 1: Bump version**

```ts
  version: "0.0.8",
```

Everything else (including the now-unused `api.tradestie.com` host_permission) stays untouched. Keeping the permission means the dormant Tradestie code still works if anyone happens to re-enable it; revisit when reviving for the Trending view.

- [ ] **Step 2: typecheck + build.** `dist/manifest.json` v0.0.8.

---

## Task 6: Single commit

- [ ] **Step 1: Commit all changes**

```bash
git add src/content/ExternalLinksBar.tsx src/content/ExternalLinksBar.test.tsx \
        src/content/SidePanel.tsx src/content/SidePanel.test.tsx \
        src/content/sidePanel.css \
        src/content/index.tsx \
        manifest.config.ts
git commit -m "feat(content): external links bar (tradingview + quiver), pause tradestie

- Tradestie section removed from panel and no longer dispatched from
  the content script. Adapter, service, message route, and host
  permission all stay in place so the Trending view (deferred) can
  surface the data when it's queried as a list instead of per-ticker.
- New ExternalLinksBar at the bottom of the side panel opens
  TradingView (chart + volume) and Quiver Quantitative for the current
  ticker in a new tab. target=_blank rel=noopener noreferrer.
- Bump 0.0.8."
```

---

## Task 7: Manual Firefox verification

- [ ] Remove + Load Temporary Add-on on `dist/manifest.json`. Version 0.0.8.
- [ ] Open AAPL security page, click Badge. Panel shows:
  - StockTwits at top with data.
  - Apewisdom section.
  - **No Tradestie section.**
  - **Links bar at bottom**: "📈 TradingView" and "🏛 Quiver" buttons.
- [ ] Click TradingView → new tab opens at `https://www.tradingview.com/chart/?symbol=AAPL`. Chart loads with AAPL.
- [ ] Click Quiver → new tab opens at `https://www.quiverquant.com/stocks/AAPL/`. Quiver page loads.
- [ ] Background DevTools Network: only OpenFIGI + Apewisdom + StockTwits calls fire. NO Tradestie call.
- [ ] Storage: `tradestie:snapshot` from earlier runs may still be there but no new entries get written.
- [ ] Switch to a DE-only ISIN: links bar disappears (no ticker resolved); panel shows no-data placeholders for the two sources.
- [ ] Tag

```bash
git tag -a v0.0.8-links-bar -m "external links bar, tradestie paused"
```

---

## Done

- 81 tests pass.
- typecheck + build exit 0.
- Firefox: panel renders 2 source sections + links bar; TradingView and Quiver open with the right ticker; no Tradestie network calls.
- Tag `v0.0.8-links-bar` on `main`.

## Deferred / next

- Tradestie revival in the Trending view step.
- Aggregation/Barometer from the 2 remaining sources (StockTwits + Apewisdom-as-buzz only — sentiment is StockTwits-only until Tradestie returns).
- More tools in the links bar as the user surfaces them.

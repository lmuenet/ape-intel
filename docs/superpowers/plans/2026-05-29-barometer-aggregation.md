# Barometer / Aggregation (Step 4.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fuse the per-source community data into one **Barometer** (confidence-weighted sentiment) plus orthogonal **Buzz** and **Trend** signals, surfaced on the Badge and at the top of the Side Panel.

**Architecture:** A pure, dependency-free module `src/lib/barometer.ts` turns the existing source entries (StockTwits, Tradestie, Apewisdom) into an `Aggregate`. Per ADR-0001 the Barometer is `Σ(sentimentᵢ·confidenceᵢ)/Σ confidenceᵢ` with `confidenceᵢ = min(1, volumeᵢ/thresholdᵢ)`. Per ADR-0004 Apewisdom contributes only to Buzz/Trend, never sentiment. Tradestie stays **paused** (the content script does not fetch it), so the live Barometer is single-source (StockTwits) and is honestly labelled "low confidence · 1 source"; the module is written for N sources so Tradestie rejoins with one extra dispatch and no formula change.

**Tech Stack:** TypeScript, Preact, Vitest, `@testing-library/preact`. Test runner: `npm test` (`vitest run`). Single file: `npx vitest run <path>`.

---

### Task 1: Barometer module — types, config, sentiment fusion

**Files:**
- Create: `src/lib/barometer.ts`
- Test: `src/lib/barometer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/barometer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeBarometer, DEFAULT_CONFIG } from "./barometer";

describe("computeBarometer", () => {
  it("returns unavailable when no sentiment source has data", () => {
    const r = computeBarometer({ apewisdom: { rank: 1, mentions: 100, mentions24hAgo: 50 } });
    expect(r.score).toBeNull();
    expect(r.label).toBe("unavailable");
    expect(r.contributingSources).toBe(0);
    expect(r.lowConfidence).toBe(true);
  });

  it("derives StockTwits sentiment from the bullish/bearish split", () => {
    const r = computeBarometer({ stocktwits: { bullish: 18, bearish: 4, totalMessages: 30 } });
    // 2*18/22 - 1 = 0.636…
    expect(r.score).toBeCloseTo(0.636, 2);
    expect(r.label).toBe("very-bullish");
    expect(r.contributingSources).toBe(1);
  });

  it("ignores a StockTwits entry with no tagged messages", () => {
    const r = computeBarometer({ stocktwits: { bullish: 0, bearish: 0, totalMessages: 12 } });
    expect(r.label).toBe("unavailable");
  });

  it("flags a single source as low confidence even at full volume", () => {
    const r = computeBarometer({ stocktwits: { bullish: 40, bearish: 40, totalMessages: 80 } });
    expect(r.contributingSources).toBe(1);
    expect(r.totalConfidence).toBe(1); // 80/20 capped at 1
    expect(r.lowConfidence).toBe(true);
    expect(r.label).toBe("neutral"); // score 0
  });

  it("confidence-weights two sources and is not low confidence when both are full", () => {
    const r = computeBarometer({
      stocktwits: { bullish: 20, bearish: 0, totalMessages: 20 }, // sentiment +1, conf 1
      tradestie: { comments: 50, sentimentLabel: "Bearish", sentimentScore: -1 }, // sentiment -1, conf 1
    });
    expect(r.score).toBeCloseTo(0, 5); // (+1*1 + -1*1) / 2
    expect(r.contributingSources).toBe(2);
    expect(r.lowConfidence).toBe(false);
  });

  it("clamps Tradestie sentimentScore into [-1, 1]", () => {
    const r = computeBarometer({ tradestie: { comments: 100, sentimentLabel: "Bullish", sentimentScore: 5 } });
    expect(r.score).toBe(1);
  });

  it("exposes tunable default thresholds", () => {
    expect(DEFAULT_CONFIG.stocktwitsConfidenceThreshold).toBe(20);
    expect(DEFAULT_CONFIG.tradestieConfidenceThreshold).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/barometer.test.ts`
Expected: FAIL — cannot find module `./barometer`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/barometer.ts`:

```ts
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";
import type { TradestieEntry } from "./tradestie";

export interface BarometerConfig {
  stocktwitsConfidenceThreshold: number;
  tradestieConfidenceThreshold: number;
  buzzBuckets: { chatter: number; loud: number; onFire: number };
}

export const DEFAULT_CONFIG: BarometerConfig = {
  stocktwitsConfidenceThreshold: 20,
  tradestieConfidenceThreshold: 50,
  buzzBuckets: { chatter: 25, loud: 100, onFire: 500 },
};

export type BarometerLabel =
  | "very-bearish" | "bearish" | "neutral" | "bullish" | "very-bullish" | "unavailable";

export interface BarometerResult {
  score: number | null;
  label: BarometerLabel;
  contributingSources: number;
  totalConfidence: number;
  lowConfidence: boolean;
}

export interface BarometerInput {
  stocktwits?: StockTwitsEntry | null;
  tradestie?: TradestieEntry | null;
  apewisdom?: ApewisdomEntry | null;
}

interface Contribution {
  sentiment: number;
  confidence: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stocktwitsContribution(e: StockTwitsEntry, threshold: number): Contribution | null {
  const tagged = e.bullish + e.bearish;
  if (tagged === 0) return null;
  return {
    sentiment: (2 * e.bullish) / tagged - 1,
    confidence: Math.min(1, tagged / threshold),
  };
}

function tradestieContribution(e: TradestieEntry, threshold: number): Contribution | null {
  if (e.comments === 0) return null;
  return {
    sentiment: clamp(e.sentimentScore, -1, 1),
    confidence: Math.min(1, e.comments / threshold),
  };
}

function labelFor(score: number): BarometerLabel {
  if (score <= -0.6) return "very-bearish";
  if (score < -0.2) return "bearish";
  if (score <= 0.2) return "neutral";
  if (score < 0.6) return "bullish";
  return "very-bullish";
}

export function computeBarometer(
  input: BarometerInput,
  config: BarometerConfig = DEFAULT_CONFIG,
): BarometerResult {
  const contributions: Contribution[] = [];
  if (input.stocktwits) {
    const c = stocktwitsContribution(input.stocktwits, config.stocktwitsConfidenceThreshold);
    if (c) contributions.push(c);
  }
  if (input.tradestie) {
    const c = tradestieContribution(input.tradestie, config.tradestieConfidenceThreshold);
    if (c) contributions.push(c);
  }

  if (contributions.length === 0) {
    return { score: null, label: "unavailable", contributingSources: 0, totalConfidence: 0, lowConfidence: true };
  }

  const totalConfidence = contributions.reduce((s, c) => s + c.confidence, 0);
  const score = contributions.reduce((s, c) => s + c.sentiment * c.confidence, 0) / totalConfidence;

  return {
    score,
    label: labelFor(score),
    contributingSources: contributions.length,
    totalConfidence,
    lowConfidence: contributions.length < 2 || totalConfidence < 0.5,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/barometer.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/barometer.ts src/lib/barometer.test.ts
git commit -m "feat(barometer): confidence-weighted sentiment fusion (ADR-0001/0004)"
```

---

### Task 2: Buzz and Trend

**Files:**
- Modify: `src/lib/barometer.ts`
- Test: `src/lib/barometer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/barometer.test.ts`:

```ts
import { computeBuzz, computeTrend } from "./barometer";

describe("computeBuzz", () => {
  it("returns none when no volume source is present", () => {
    expect(computeBuzz({})).toEqual({ level: "none", mentions: null });
  });

  it("buckets Apewisdom mentions at the default boundaries", () => {
    const buzz = (mentions: number) =>
      computeBuzz({ apewisdom: { rank: 1, mentions, mentions24hAgo: 0 } }).level;
    expect(buzz(24)).toBe("quiet");
    expect(buzz(25)).toBe("chatter");
    expect(buzz(99)).toBe("chatter");
    expect(buzz(100)).toBe("loud");
    expect(buzz(499)).toBe("loud");
    expect(buzz(500)).toBe("on-fire");
  });

  it("falls back to StockTwits message count when Apewisdom is absent", () => {
    const r = computeBuzz({ stocktwits: { bullish: 1, bearish: 1, totalMessages: 30 } });
    expect(r).toEqual({ level: "chatter", mentions: 30 });
  });
});

describe("computeTrend", () => {
  it("is unknown without Apewisdom", () => {
    expect(computeTrend({ stocktwits: { bullish: 1, bearish: 1, totalMessages: 2 } })).toBe("unknown");
  });

  it("reads direction from mentions vs mentions24hAgo", () => {
    expect(computeTrend({ apewisdom: { rank: 1, mentions: 100, mentions24hAgo: 50 } })).toBe("up");
    expect(computeTrend({ apewisdom: { rank: 1, mentions: 50, mentions24hAgo: 100 } })).toBe("down");
    expect(computeTrend({ apewisdom: { rank: 1, mentions: 80, mentions24hAgo: 80 } })).toBe("flat");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/barometer.test.ts`
Expected: FAIL — `computeBuzz`/`computeTrend` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/barometer.ts`:

```ts
export type BuzzLevel = "none" | "quiet" | "chatter" | "loud" | "on-fire";

export interface BuzzResult {
  level: BuzzLevel;
  mentions: number | null;
}

export function computeBuzz(
  input: BarometerInput,
  config: BarometerConfig = DEFAULT_CONFIG,
): BuzzResult {
  let mentions: number | null = null;
  if (input.apewisdom) mentions = input.apewisdom.mentions;
  else if (input.stocktwits) mentions = input.stocktwits.totalMessages;

  if (mentions === null) return { level: "none", mentions: null };

  const { chatter, loud, onFire } = config.buzzBuckets;
  let level: BuzzLevel;
  if (mentions >= onFire) level = "on-fire";
  else if (mentions >= loud) level = "loud";
  else if (mentions >= chatter) level = "chatter";
  else level = "quiet";

  return { level, mentions };
}

export type TrendDirection = "up" | "flat" | "down" | "unknown";

export function computeTrend(input: BarometerInput): TrendDirection {
  if (!input.apewisdom) return "unknown";
  const { mentions, mentions24hAgo } = input.apewisdom;
  if (mentions > mentions24hAgo) return "up";
  if (mentions < mentions24hAgo) return "down";
  return "flat";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/barometer.test.ts`
Expected: PASS (all tests, including Task 1's).

- [ ] **Step 5: Commit**

```bash
git add src/lib/barometer.ts src/lib/barometer.test.ts
git commit -m "feat(barometer): Buzz bucketing and Trend direction"
```

---

### Task 3: `aggregate()` convenience + display label maps

**Files:**
- Modify: `src/lib/barometer.ts`
- Test: `src/lib/barometer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/barometer.test.ts`:

```ts
import { aggregate, BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW } from "./barometer";

describe("aggregate", () => {
  it("bundles barometer, buzz, and trend", () => {
    const r = aggregate({
      stocktwits: { bullish: 18, bearish: 4, totalMessages: 30 },
      apewisdom: { rank: 5, mentions: 247, mentions24hAgo: 180 },
    });
    expect(r.barometer.label).toBe("very-bullish");
    expect(r.buzz.level).toBe("loud");
    expect(r.trend).toBe("up");
  });
});

describe("display maps", () => {
  it("has human text for every barometer label", () => {
    expect(BAROMETER_LABEL_TEXT.unavailable).toMatch(/no sentiment/i);
    expect(BAROMETER_LABEL_TEXT["very-bullish"]).toBe("Very Bullish");
  });
  it("maps trend directions to arrows", () => {
    expect(TREND_ARROW.up).toBe("↑");
    expect(TREND_ARROW.down).toBe("↓");
    expect(TREND_ARROW.flat).toBe("→");
    expect(TREND_ARROW.unknown).toBe("·");
  });
  it("maps buzz levels to text", () => {
    expect(BUZZ_TEXT["on-fire"]).toMatch(/fire/i);
    expect(BUZZ_TEXT.none).toBe("—");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/barometer.test.ts`
Expected: FAIL — `aggregate`/maps not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/barometer.ts`:

```ts
export interface Aggregate {
  barometer: BarometerResult;
  buzz: BuzzResult;
  trend: TrendDirection;
}

export function aggregate(
  input: BarometerInput,
  config: BarometerConfig = DEFAULT_CONFIG,
): Aggregate {
  return {
    barometer: computeBarometer(input, config),
    buzz: computeBuzz(input, config),
    trend: computeTrend(input),
  };
}

export const BAROMETER_LABEL_TEXT: Record<BarometerLabel, string> = {
  "very-bearish": "Very Bearish",
  bearish: "Bearish",
  neutral: "Neutral",
  bullish: "Bullish",
  "very-bullish": "Very Bullish",
  unavailable: "No sentiment data",
};

export const BUZZ_TEXT: Record<BuzzLevel, string> = {
  none: "—",
  quiet: "Quiet",
  chatter: "Chatter",
  loud: "Loud",
  "on-fire": "On fire",
};

export const TREND_ARROW: Record<TrendDirection, string> = {
  up: "↑",
  flat: "→",
  down: "↓",
  unknown: "·",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/barometer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/barometer.ts src/lib/barometer.test.ts
git commit -m "feat(barometer): aggregate() bundle + display label maps"
```

---

### Task 4: Badge shows Barometer / Buzz / Trend

**Files:**
- Modify: `src/content/Badge.tsx`
- Modify: `src/content/badge.css`
- Test: `src/content/Badge.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/content/Badge.test.tsx` (inside the `describe`, before the closing `});`):

```ts
  it("renders the barometer label, buzz, and trend when aggregate is provided", () => {
    const aggregate = {
      barometer: { score: 0.64, label: "very-bullish" as const, contributingSources: 1, totalConfidence: 1, lowConfidence: true },
      buzz: { level: "loud" as const, mentions: 247 },
      trend: "up" as const,
    };
    const { getByText } = render(<Badge isin="US0378331005" ticker="AAPL" aggregate={aggregate} />);
    expect(getByText("Very Bullish")).toBeTruthy();
    expect(getByText(/Loud/)).toBeTruthy();
    expect(getByText("↑")).toBeTruthy();
  });

  it("omits the barometer row when aggregate is undefined", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" />);
    expect(container.querySelector(".ape-intel-badge__barometer")).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/Badge.test.tsx`
Expected: FAIL — `aggregate` is not a Badge prop / label not rendered.

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `src/content/Badge.tsx` with:

```tsx
import "./badge.css";
import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
  aggregate?: Aggregate | null;
  onClick?: () => void;
}

export function Badge({ isin, ticker, aggregate, onClick }: BadgeProps) {
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
      {aggregate ? (
        <span class="ape-intel-badge__barometer">
          <span class="ape-intel-badge__barometer-label">
            {BAROMETER_LABEL_TEXT[aggregate.barometer.label]}
          </span>
          <span class="ape-intel-badge__buzz">{BUZZ_TEXT[aggregate.buzz.level]}</span>
          <span class="ape-intel-badge__trend">{TREND_ARROW[aggregate.trend]}</span>
        </span>
      ) : null}
    </button>
  );
}
```

Append to `src/content/badge.css`:

```css
.ape-intel-badge__barometer {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
  font-size: 11px;
}

.ape-intel-badge__barometer-label {
  font-weight: 600;
}

.ape-intel-badge__buzz,
.ape-intel-badge__trend {
  opacity: 0.8;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/Badge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/Badge.tsx src/content/badge.css src/content/Badge.test.tsx
git commit -m "feat(badge): surface Barometer/Buzz/Trend headline"
```

---

### Task 5: Side Panel Barometer section

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/sidePanel.css`
- Test: `src/content/SidePanel.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/content/SidePanel.test.tsx`, add an `aggregate` field to the shared `defaults` object so existing tests keep type-checking. Replace the `defaults` declaration with:

```ts
import type { Aggregate } from "../lib/barometer";

const fullAggregate: Aggregate = {
  barometer: { score: 0.64, label: "very-bullish", contributingSources: 1, totalConfidence: 1, lowConfidence: true },
  buzz: { level: "loud", mentions: 247 },
  trend: "up",
};

const defaults = {
  isOpen: true,
  ticker: "AAPL" as string | null | undefined,
  apewisdom: apewisdom() as ApewisdomEntry | null | undefined,
  stocktwits: stocktwits() as StockTwitsEntry | null | undefined,
  aggregate: fullAggregate as Aggregate | null | undefined,
  onClose: () => {},
  onTradingViewClick: () => {},
};
```

Then append these tests inside the `describe`, before its closing `});`:

```ts
  it("renders the Barometer headline label and score", () => {
    const { getByText, container } = render(<SidePanel {...defaults} />);
    expect(container.querySelector(".ape-intel-panel__barometer")).toBeTruthy();
    expect(getByText("Very Bullish")).toBeTruthy();
    expect(getByText("+0.64")).toBeTruthy();
  });

  it("shows a low-confidence note with the source count", () => {
    const { getByText } = render(<SidePanel {...defaults} />);
    expect(getByText(/low confidence · 1 source/i)).toBeTruthy();
  });

  it("shows 'No sentiment data' and no low-confidence note when unavailable", () => {
    const unavailable: Aggregate = {
      barometer: { score: null, label: "unavailable", contributingSources: 0, totalConfidence: 0, lowConfidence: true },
      buzz: { level: "none", mentions: null },
      trend: "unknown",
    };
    const { getByText, queryByText } = render(<SidePanel {...defaults} aggregate={unavailable} />);
    expect(getByText(/No sentiment data/i)).toBeTruthy();
    expect(queryByText(/low confidence/i)).toBeNull();
  });

  it("shows Loading in the Barometer section when aggregate is undefined", () => {
    const { container } = render(<SidePanel {...defaults} aggregate={undefined} />);
    const section = container.querySelector(".ape-intel-panel__barometer")!;
    expect(section.textContent).toMatch(/Loading/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — no `.ape-intel-panel__barometer` element / `aggregate` prop unused.

- [ ] **Step 3: Write minimal implementation**

In `src/content/SidePanel.tsx`, add imports at the top (after the existing type imports):

```tsx
import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";
```

Add `aggregate` to `SidePanelProps`:

```tsx
export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  aggregate: Aggregate | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
  onClose: () => void;
  onTradingViewClick: () => void;
}
```

Add this helper + section component above the `SidePanel` function (the `Placeholder` component already exists in the file):

```tsx
function scoreText(score: number | null): string {
  if (score === null) return "—";
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

function BarometerSection({ aggregate }: { aggregate: Aggregate | null | undefined }) {
  return (
    <section class="ape-intel-panel__barometer">
      <h3 class="ape-intel-panel__section-title">Barometer</h3>
      {aggregate === undefined ? <Placeholder>Loading…</Placeholder> : (
        <div class="ape-intel-panel__barometer-body">
          <div class="ape-intel-panel__barometer-headline">
            <span
              class="ape-intel-panel__barometer-label"
              data-label={aggregate.barometer.label}
            >
              {BAROMETER_LABEL_TEXT[aggregate.barometer.label]}
            </span>
            <span class="ape-intel-panel__barometer-score">
              {scoreText(aggregate.barometer.score)}
            </span>
          </div>
          {aggregate.barometer.label !== "unavailable" && aggregate.barometer.lowConfidence ? (
            <p class="ape-intel-panel__barometer-note">
              low confidence · {aggregate.barometer.contributingSources}{" "}
              source{aggregate.barometer.contributingSources === 1 ? "" : "s"}
            </p>
          ) : null}
          <dl class="ape-intel-panel__stats ape-intel-panel__stats--two">
            <div><dt>Buzz</dt><dd>{BUZZ_TEXT[aggregate.buzz.level]}</dd></div>
            <div><dt>Trend</dt><dd>{TREND_ARROW[aggregate.trend]}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}
```

Update the `SidePanel` function signature and body to accept `aggregate` and render the section right after the header:

```tsx
export function SidePanel({
  isOpen, ticker, aggregate, apewisdom, stocktwits, onClose, onTradingViewClick,
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
      <ExternalLinksBar ticker={ticker} onTradingViewClick={onTradingViewClick} />
    </aside>
  );
}
```

Append to `src/content/sidePanel.css`:

```css
.ape-intel-panel__barometer {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.ape-intel-panel__barometer-headline {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.ape-intel-panel__barometer-label {
  font-size: 18px;
  font-weight: 700;
}

.ape-intel-panel__barometer-score {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.ape-intel-panel__barometer-note {
  margin: 4px 0 0;
  font-size: 11px;
  opacity: 0.6;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/SidePanel.tsx src/content/sidePanel.css src/content/SidePanel.test.tsx
git commit -m "feat(side-panel): Barometer section with low-confidence note"
```

---

### Task 6: Wire aggregation into the content script

**Files:**
- Modify: `src/content/index.tsx`

> No unit test: `index.tsx` is the un-tested orchestration layer in this project (matches existing convention). Verified via typecheck + build + manual load. Tradestie stays paused — it is intentionally **not** fetched here.

- [ ] **Step 1: Add the import**

In `src/content/index.tsx`, add after the existing `import type { StockTwitsEntry } ...` line:

```tsx
import { aggregate, type Aggregate } from "../lib/barometer";
```

- [ ] **Step 2: Add the aggregate helper**

In `src/content/index.tsx`, add this function immediately above `function paint(): void {`:

```tsx
function currentAggregate(): Aggregate | undefined {
  // undefined while either sentiment/volume source is still loading
  if (currentStockTwits === undefined || currentApewisdom === undefined) return undefined;
  return aggregate({ stocktwits: currentStockTwits, apewisdom: currentApewisdom });
}
```

- [ ] **Step 3: Pass the aggregate into Badge and SidePanel**

In `paint()`, update the `<Badge>` and `<SidePanel>` JSX. The `<Badge>` becomes:

```tsx
      <Badge
        isin={currentIsin}
        ticker={currentTicker}
        aggregate={currentAggregate()}
        onClick={() => { isPanelOpen = !isPanelOpen; paint(); }}
      />
```

And add the `aggregate` prop to `<SidePanel>` (keep all existing props):

```tsx
      <SidePanel
        isOpen={isPanelOpen}
        ticker={currentTicker}
        aggregate={currentAggregate()}
        apewisdom={currentApewisdom}
        stocktwits={currentStockTwits}
        onClose={() => { isPanelOpen = false; paint(); }}
        onTradingViewClick={() => { isChartOpen = true; paint(); }}
      />
```

- [ ] **Step 4: Typecheck and full test run**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass (barometer, Badge, SidePanel, and the pre-existing suites).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 6: Manual verification (Firefox)**

1. `about:debugging` → This Firefox → Load Temporary Add-on → select the built `manifest.json`.
2. Open a US-listed stock on Scalable (e.g. AAPL, `?isin=US0378331005`).
3. Confirm: Badge shows a Barometer label + Buzz + Trend; Side Panel top shows the Barometer section with a "low confidence · 1 source" note (expected while Tradestie is paused).
4. Open an Uncovered asset (e.g. a German-only stock / ETF): Barometer shows "No sentiment data", no low-confidence note.

- [ ] **Step 7: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat(content): compute and pass aggregate to Badge + Side Panel"
```

---

## Self-Review notes

- **Spec coverage:** Barometer formula (Task 1), Buzz/Trend (Task 2), display + aggregate bundle (Task 3), Badge headline per PRD F3 (Task 4), Side Panel breakdown + low-confidence label per the design (Task 5), wiring with Tradestie paused (Task 6). All design points covered.
- **Type consistency:** `Aggregate`, `BarometerResult`, `BuzzResult`, `TrendDirection`, `BAROMETER_LABEL_TEXT`, `BUZZ_TEXT`, `TREND_ARROW`, `aggregate()`, `computeBarometer/Buzz/Trend` names are identical across Tasks 1–6 and the component props.
- **Single-source honesty:** `lowConfidence = contributingSources < 2 || totalConfidence < 0.5` guarantees the "1 source" label fires while Tradestie is paused; reactivation (a second dispatch in `index.tsx` + passing `tradestie` into `aggregate`) clears it with no formula change.
- **Calibration:** all thresholds live in `DEFAULT_CONFIG`; revisit with real data per ADR-0001 §Consequences.
```

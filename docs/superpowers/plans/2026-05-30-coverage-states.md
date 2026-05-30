# Coverage States (Step 8a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify each Asset as Covered / Thin / Uncovered (or unknown while loading) from data the content script already holds, and show it as a colour-coded dot on the Badge and a labelled chip in the Side Panel header.

**Architecture:** A pure lib (`coverage.ts`) classifies coverage and maps it to display text. The Badge gets an optional `coverage` dot; the Side Panel header gets a `coverage` chip. The content layer computes coverage via a `currentCoverage()` helper (mirroring `currentAggregate()`) and passes it to both.

**Tech Stack:** TypeScript, Preact, Vitest, `@testing-library/preact`. Runner: `npm test`; single file: `npx vitest run <path>`; types: `npm run typecheck`; build: `npm run build`.

**Design doc:** `docs/superpowers/specs/2026-05-30-coverage-states-design.md`.

---

### Task 1: Coverage classifier lib

**Files:**
- Create: `src/lib/coverage.ts`
- Test: `src/lib/coverage.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/coverage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyCoverage, COVERAGE_TEXT, COVERAGE_DETAIL, type Coverage } from "./coverage";
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";

const ape = (mentions: number): ApewisdomEntry => ({ rank: 1, mentions, mentions24hAgo: 0 });
const st = (totalMessages: number): StockTwitsEntry => ({ bullish: 0, bearish: 0, totalMessages });

describe("classifyCoverage", () => {
  it("is unknown while the ticker is still resolving", () => {
    expect(classifyCoverage({ ticker: undefined, apewisdom: undefined, stocktwits: undefined })).toBe("unknown");
  });
  it("is uncovered when there is no ticker mapping", () => {
    expect(classifyCoverage({ ticker: null, apewisdom: null, stocktwits: null })).toBe("uncovered");
  });
  it("is unknown when the ticker resolved but a source is still loading", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: undefined, stocktwits: null })).toBe("unknown");
  });
  it("is thin when the ticker resolved but both sources are empty", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: null, stocktwits: null })).toBe("thin");
  });
  it("is thin when sources are present but have zero volume", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: ape(0), stocktwits: st(0) })).toBe("thin");
  });
  it("is covered when apewisdom has mentions", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: ape(12), stocktwits: null })).toBe("covered");
  });
  it("is covered when stocktwits has messages", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: null, stocktwits: st(5) })).toBe("covered");
  });
  it("exposes label and detail text for every state", () => {
    const states: Coverage[] = ["covered", "thin", "uncovered", "unknown"];
    for (const s of states) {
      expect(typeof COVERAGE_TEXT[s]).toBe("string");
      expect(typeof COVERAGE_DETAIL[s]).toBe("string");
    }
    expect(COVERAGE_TEXT.covered).toBe("Covered");
    expect(COVERAGE_TEXT.thin).toBe("Thin coverage");
    expect(COVERAGE_TEXT.uncovered).toBe("Uncovered");
    expect(COVERAGE_TEXT.unknown).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/coverage.test.ts`
Expected: FAIL — cannot find module `./coverage`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/coverage.ts`:

```ts
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";

export type Coverage = "covered" | "thin" | "uncovered" | "unknown";

export interface CoverageInput {
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
}

export function classifyCoverage({ ticker, apewisdom, stocktwits }: CoverageInput): Coverage {
  if (ticker === undefined) return "unknown";
  if (ticker === null) return "uncovered";
  if (apewisdom === undefined || stocktwits === undefined) return "unknown";
  const hasChatter =
    (apewisdom !== null && apewisdom.mentions > 0) ||
    (stocktwits !== null && stocktwits.totalMessages > 0);
  return hasChatter ? "covered" : "thin";
}

export const COVERAGE_TEXT: Record<Coverage, string> = {
  covered: "Covered",
  thin: "Thin coverage",
  uncovered: "Uncovered",
  unknown: "",
};

export const COVERAGE_DETAIL: Record<Coverage, string> = {
  covered: "US-listed with active community chatter.",
  thin: "Mapped to a US ticker, but sources are quiet.",
  uncovered: "No US-ticker mapping (ETF or non-US listing) — limited data.",
  unknown: "",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/coverage.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverage.ts src/lib/coverage.test.ts
git commit -m "feat(coverage): classify Covered/Thin/Uncovered + display text"
```
(Commit messages in this repo end with a trailing line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

### Task 2: Coverage dot on the Badge

**Files:**
- Modify: `src/content/Badge.tsx`
- Modify: `src/content/badge.css`
- Test: `src/content/Badge.test.tsx`

- [ ] **Step 1: Write the failing test** — APPEND inside the existing `describe("<Badge />", …)` block in `src/content/Badge.test.tsx`, before its closing `});`:

```tsx
  it("renders a coverage dot with the state and an aria-label", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" coverage="covered" />);
    const dot = container.querySelector(".ape-intel-badge__coverage");
    expect(dot).toBeTruthy();
    expect(dot!.getAttribute("data-coverage")).toBe("covered");
    expect(dot!.getAttribute("aria-label")).toBe("Coverage: Covered");
  });

  it("omits the coverage dot when coverage is unknown", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" coverage="unknown" />);
    expect(container.querySelector(".ape-intel-badge__coverage")).toBeNull();
  });

  it("omits the coverage dot when coverage is not provided", () => {
    const { container } = render(<Badge isin="US0378331005" ticker="AAPL" />);
    expect(container.querySelector(".ape-intel-badge__coverage")).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/Badge.test.tsx`
Expected: FAIL — `coverage` not a prop / no `.ape-intel-badge__coverage`.

- [ ] **Step 3: Write minimal implementation** — replace the ENTIRE contents of `src/content/Badge.tsx` with:

```tsx
import "./badge.css";
import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";
import { COVERAGE_TEXT, type Coverage } from "../lib/coverage";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
  aggregate?: Aggregate | null;
  coverage?: Coverage;
  onClick?: () => void;
}

export function Badge({ isin, ticker, aggregate, coverage, onClick }: BadgeProps) {
  return (
    <button
      type="button"
      class="ape-intel-badge"
      aria-label="Open Ape Intel side panel"
      onClick={onClick}
    >
      <span class="ape-intel-badge__brand">Ape Intel</span>
      {coverage && coverage !== "unknown" ? (
        <span
          class="ape-intel-badge__coverage"
          data-coverage={coverage}
          aria-label={`Coverage: ${COVERAGE_TEXT[coverage]}`}
        />
      ) : null}
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

- [ ] **Step 4: Append CSS to `src/content/badge.css`:**

```css
.ape-intel-badge__coverage {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #888; vertical-align: middle;
}
.ape-intel-badge__coverage[data-coverage="covered"] { background: #4ade80; }
.ape-intel-badge__coverage[data-coverage="thin"] { background: #fbbf24; }
.ape-intel-badge__coverage[data-coverage="uncovered"] { background: #888; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/content/Badge.test.tsx`
Expected: PASS (existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add src/content/Badge.tsx src/content/badge.css src/content/Badge.test.tsx
git commit -m "feat(badge): coverage dot indicator"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

### Task 3: Coverage chip in the Side Panel header

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/sidePanel.css`
- Modify: `src/content/SidePanel.test.tsx`
- Modify: `src/content/index.tsx` (temporary stub prop only — real wiring is Task 4)

- [ ] **Step 1: Write the failing test** — in `src/content/SidePanel.test.tsx`:

(a) Add a field to the `defaults` object (after `onClearStrategy: () => {},`):
```ts
  coverage: "covered" as import("../lib/coverage").Coverage,
```
(b) Append these tests inside `describe("<SidePanel />", …)`:
```ts
  it("renders the coverage chip with label and detail", () => {
    const { container, getByText } = render(<SidePanel {...defaults} coverage="thin" />);
    const chip = container.querySelector(".ape-intel-panel__coverage");
    expect(chip).toBeTruthy();
    expect(chip!.getAttribute("data-coverage")).toBe("thin");
    expect(getByText("Thin coverage")).toBeTruthy();
    expect(getByText(/sources are quiet/i)).toBeTruthy();
  });

  it("hides the coverage chip when coverage is unknown", () => {
    const { container } = render(<SidePanel {...defaults} coverage="unknown" />);
    expect(container.querySelector(".ape-intel-panel__coverage")).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `coverage` not a prop / no `.ape-intel-panel__coverage`.

- [ ] **Step 3: Write minimal implementation** — in `src/content/SidePanel.tsx`:

(a) Add an import after `import type { StoredStrategy } from "../lib/strategy";`:
```tsx
import { COVERAGE_TEXT, COVERAGE_DETAIL, type Coverage } from "../lib/coverage";
```
(b) Add a field to `SidePanelProps` (after `onClearStrategy: () => void;`):
```tsx
  coverage: Coverage;
```
(c) Extend the destructured params line `strategy, parseError, onSaveStrategy, onClearStrategy,` to:
```tsx
  strategy, parseError, onSaveStrategy, onClearStrategy, coverage,
```
(d) Insert the chip immediately AFTER the `{ticker && showCapHint ? <p class="ape-intel-panel__cap-hint">Max 20 favourites.</p> : null}` line and BEFORE `<BarometerSection aggregate={aggregate} />`:
```tsx
      {coverage !== "unknown" ? (
        <p class="ape-intel-panel__coverage" data-coverage={coverage}>
          <span class="ape-intel-panel__coverage-label">{COVERAGE_TEXT[coverage]}</span>
          <span class="ape-intel-panel__coverage-detail">{COVERAGE_DETAIL[coverage]}</span>
        </p>
      ) : null}
```

- [ ] **Step 4: Append CSS to `src/content/sidePanel.css`:**

```css
.ape-intel-panel__coverage {
  margin: 0 0 12px; padding: 6px 10px; border-radius: 6px; background: #1a1a1a;
  border-left: 3px solid #888; display: flex; flex-direction: column; gap: 2px;
}
.ape-intel-panel__coverage[data-coverage="covered"] { border-left-color: #4ade80; }
.ape-intel-panel__coverage[data-coverage="thin"] { border-left-color: #fbbf24; }
.ape-intel-panel__coverage[data-coverage="uncovered"] { border-left-color: #888; }
.ape-intel-panel__coverage-label { font-weight: 600; font-size: 12px; }
.ape-intel-panel__coverage-detail { font-size: 11px; opacity: 0.7; }
```

- [ ] **Step 5: Add a temporary stub prop in `src/content/index.tsx`** so it still typechecks (real wiring lands in Task 4). In the `<SidePanel … />` JSX, after the `onClearStrategy={…}` line, add:
```tsx
        coverage="unknown"
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS (existing + 2 new).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/content/SidePanel.tsx src/content/sidePanel.css src/content/SidePanel.test.tsx src/content/index.tsx
git commit -m "feat(side-panel): coverage chip in header"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

### Task 4: Wire coverage in the content script

**Files:**
- Modify: `src/content/index.tsx`

> No unit test (orchestration layer); verified via typecheck + full suite + build + manual check.

- [ ] **Step 1: Add the import** — after `import { aggregate as computeAggregate } from "../lib/barometer";` add:
```tsx
import { classifyCoverage, type Coverage } from "../lib/coverage";
```

- [ ] **Step 2: Add a `currentCoverage()` helper** — immediately after the `currentAggregate()` function definition, add:
```tsx
function currentCoverage(): Coverage {
  return classifyCoverage({
    ticker: currentTicker,
    apewisdom: currentApewisdom,
    stocktwits: currentStockTwits,
  });
}
```

- [ ] **Step 3: Pass coverage to the Badge** — in the `<Badge … />` JSX, after the `aggregate={currentAggregate()}` line, add:
```tsx
        coverage={currentCoverage()}
```

- [ ] **Step 4: Replace the SidePanel stub prop** — change the `coverage="unknown"` line (from Task 3) in the `<SidePanel … />` JSX to:
```tsx
        coverage={currentCoverage()}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification (Firefox)**

1. `npm run build`, reload the add-on from `dist/manifest.json`, reload a Scalable security page.
2. Open a US-listed stock with chatter → Badge shows a **green** dot; the panel header shows a **Covered** chip ("US-listed with active community chatter.").
3. Open a US-listed but quiet stock → **amber** dot + **Thin coverage** chip.
4. Open an ETF / non-US asset (ticker doesn't resolve) → **grey** dot + **Uncovered** chip ("No US-ticker mapping …").
5. While data is loading, no dot/chip flashes a wrong state.

- [ ] **Step 7: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat(content): wire coverage state into Badge + Side Panel"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

## Self-Review notes

- **Spec coverage:** classification with the unknown/uncovered/thin/covered branches and volume-based chatter rule (Task 1, §2); display text maps (Task 1, §3); Badge dot gated on a known state (Task 2, §4); Side Panel header chip with label + detail gated on a known state (Task 3, §4); content `currentCoverage()` wiring to both surfaces + manual verification (Task 4, §5). All design sections covered.
- **Type consistency:** `Coverage`, `CoverageInput`, `classifyCoverage`, `COVERAGE_TEXT`, `COVERAGE_DETAIL` are defined in `coverage.ts` and imported identically by `Badge.tsx`, `SidePanel.tsx`, and `index.tsx`. Badge's `coverage?` is optional (no content stub needed for Task 2); SidePanel's `coverage` is required, so Task 3 adds a `coverage="unknown"` stub that Task 4 replaces with `currentCoverage()`.
- **Scope honored:** coverage is derived (never stored); no new data sources; complements rather than replaces the existing per-source "no data" placeholders.
- **Stub bridge:** Task 3's `coverage="unknown"` stub keeps the content script typechecking between tasks; Task 4 wires the real `currentCoverage()`.
```

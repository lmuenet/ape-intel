# AI Briefing + Export (Step 7a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble a Markdown Briefing from the data the Side Panel already holds and let the user copy `Export Prompt + Briefing` to the clipboard for pasting into an external LLM, with the prompt requesting a re-ingestable hybrid (readable + fenced-JSON) answer.

**Architecture:** A pure lib (`briefing.ts`) produces the Markdown + the fixed Export Prompt + the clipboard payload. The Side Panel renders a "Copy briefing for AI" button driven by a `copyState`. The content layer assembles the payload from its module state and writes it via `navigator.clipboard.writeText`. No API key, no provider adapter, no storage.

**Tech Stack:** TypeScript, Preact, Vitest, `@testing-library/preact`. Runner: `npm test`; single file: `npx vitest run <path>`; types: `npm run typecheck`; build: `npm run build`.

**Design doc:** `docs/superpowers/specs/2026-05-30-ai-briefing-export-design.md`.

---

### Task 1: Briefing lib (assembly + export prompt + payload)

**Files:**
- Create: `src/lib/briefing.ts`
- Test: `src/lib/briefing.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/briefing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Aggregate } from "./barometer";
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";
import type { EarningsDate, NewsItem } from "./finnhub";
import { assembleBriefing, buildClipboardPayload, EXPORT_PROMPT, type BriefingInput } from "./briefing";

const aggregate: Aggregate = {
  barometer: { score: 0.7, label: "very-bullish", contributingSources: 1, totalConfidence: 1, lowConfidence: true },
  buzz: { level: "loud", mentions: 247 },
  trend: "up",
};
const apewisdom: ApewisdomEntry = { rank: 5, mentions: 247, mentions24hAgo: 180 };
const stocktwits: StockTwitsEntry = { bullish: 18, bearish: 4, totalMessages: 30 };
const news: NewsItem[] = [
  { headline: "Acme posts record quarter", source: "Reuters", url: "u", datetime: 1747699200, catalyst: "earnings" },
];
const earnings: EarningsDate = { date: "2026-06-02", epsEstimate: 2.15 };

const full = (): BriefingInput => ({
  ticker: "AAPL", aggregate, apewisdom, stocktwits, news, earnings,
});

describe("assembleBriefing", () => {
  it("includes the ticker as the title", () => {
    expect(assembleBriefing(full())).toContain("# Ape Intel Briefing — AAPL");
  });
  it("renders the barometer label, score and low-confidence note", () => {
    const out = assembleBriefing(full());
    expect(out).toContain("Very Bullish (score 0.70)");
    expect(out).toContain("Low confidence (1 source).");
  });
  it("renders buzz, mentions and a worded trend", () => {
    const out = assembleBriefing(full());
    expect(out).toContain("Buzz: Loud (247 mentions)");
    expect(out).toContain("Trend: rising");
  });
  it("renders both community sources", () => {
    const out = assembleBriefing(full());
    expect(out).toContain("StockTwits: 18 bullish / 4 bearish (30 messages)");
    expect(out).toContain("Apewisdom: 247 mentions, rank #5");
  });
  it("renders the next earnings date with EPS", () => {
    expect(assembleBriefing(full())).toContain("Next: 2026-06-02, EPS est. 2.15");
  });
  it("renders news headlines with source, date and catalyst", () => {
    expect(assembleBriefing(full())).toContain("- Acme posts record quarter (Reuters, 2025-05-20) [Earnings]");
  });

  it("shows explicit empty states", () => {
    const out = assembleBriefing({
      ticker: "ZZZ", aggregate: null, apewisdom: null, stocktwits: null, news: [], earnings: null,
    });
    expect(out).toContain("No sentiment data.");
    expect(out).toContain("StockTwits: no data.");
    expect(out).toContain("Apewisdom: no data.");
    expect(out).toContain("No upcoming earnings.");
    expect(out).toContain("No recent news.");
  });

  it("omits the EPS estimate when null", () => {
    const out = assembleBriefing({ ...full(), earnings: { date: "2026-07-01", epsEstimate: null } });
    expect(out).toContain("Next: 2026-07-01");
    expect(out).not.toContain("EPS est.");
  });
});

describe("EXPORT_PROMPT", () => {
  it("names the three analysis blocks", () => {
    expect(EXPORT_PROMPT).toContain("What the community is saying");
    expect(EXPORT_PROMPT).toContain("What the news is saying");
    expect(EXPORT_PROMPT).toContain("What to watch out for");
  });
  it("forbids buy/sell advice", () => {
    expect(EXPORT_PROMPT.toLowerCase()).toContain("buy or sell");
  });
  it("requests a fenced json block with the three keys", () => {
    expect(EXPORT_PROMPT).toContain("```json");
    expect(EXPORT_PROMPT).toContain("community");
    expect(EXPORT_PROMPT).toContain("news");
    expect(EXPORT_PROMPT).toContain("watchOuts");
  });
});

describe("buildClipboardPayload", () => {
  it("is the prompt, a blank line, then the briefing", () => {
    const input = full();
    expect(buildClipboardPayload(input)).toBe(`${EXPORT_PROMPT}\n\n${assembleBriefing(input)}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/briefing.test.ts`
Expected: FAIL — cannot find module `./briefing`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/briefing.ts`:

```ts
import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, type Aggregate, type TrendDirection } from "./barometer";
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";
import type { EarningsDate, NewsItem } from "./finnhub";
import { CATALYST_LABEL } from "./catalyst";

export interface BriefingInput {
  ticker: string;
  aggregate: Aggregate | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
  news: NewsItem[] | null | undefined;
  earnings: EarningsDate | null | undefined;
}

const TREND_WORD: Record<TrendDirection, string> = {
  up: "rising",
  flat: "flat",
  down: "falling",
  unknown: "unknown",
};

function newsDate(datetime: number): string {
  return new Date(datetime * 1000).toISOString().slice(0, 10);
}

export function assembleBriefing(input: BriefingInput): string {
  const lines: string[] = [];
  lines.push(`# Ape Intel Briefing — ${input.ticker}`, "");

  const agg = input.aggregate;

  lines.push("## Barometer");
  if (agg && agg.barometer.label !== "unavailable" && agg.barometer.score !== null) {
    lines.push(`${BAROMETER_LABEL_TEXT[agg.barometer.label]} (score ${agg.barometer.score.toFixed(2)})`);
    if (agg.barometer.lowConfidence) {
      const n = agg.barometer.contributingSources;
      lines.push(`Low confidence (${n} source${n === 1 ? "" : "s"}).`);
    }
  } else {
    lines.push("No sentiment data.");
  }
  lines.push("");

  lines.push("## Buzz & Trend");
  if (agg) {
    lines.push(`Buzz: ${BUZZ_TEXT[agg.buzz.level]}${agg.buzz.mentions !== null ? ` (${agg.buzz.mentions} mentions)` : ""}`);
    lines.push(`Trend: ${TREND_WORD[agg.trend]}`);
  } else {
    lines.push("No buzz/trend data.");
  }
  lines.push("");

  lines.push("## Community");
  lines.push(
    input.stocktwits
      ? `StockTwits: ${input.stocktwits.bullish} bullish / ${input.stocktwits.bearish} bearish (${input.stocktwits.totalMessages} messages)`
      : "StockTwits: no data.",
  );
  lines.push(
    input.apewisdom
      ? `Apewisdom: ${input.apewisdom.mentions} mentions, rank #${input.apewisdom.rank}`
      : "Apewisdom: no data.",
  );
  lines.push("");

  lines.push("## Earnings");
  lines.push(
    input.earnings
      ? `Next: ${input.earnings.date}${input.earnings.epsEstimate !== null ? `, EPS est. ${input.earnings.epsEstimate}` : ""}`
      : "No upcoming earnings.",
  );
  lines.push("");

  lines.push("## News");
  if (input.news && input.news.length > 0) {
    for (const it of input.news) {
      lines.push(`- ${it.headline} (${it.source}, ${newsDate(it.datetime)}) [${CATALYST_LABEL[it.catalyst]}]`);
    }
  } else {
    lines.push("No recent news.");
  }

  return lines.join("\n");
}

export const EXPORT_PROMPT = [
  "You are a sober equity-research assistant. Below is a structured briefing about a single stock,",
  "assembled by a browser extension from community-sentiment and news sources. Analyse it and respond",
  "in three readable sections:",
  "",
  "1. **What the community is saying** — synthesise the sentiment and buzz signals.",
  "2. **What the news is saying** — summarise the headlines and likely catalysts.",
  "3. **What to watch out for** — risks, caveats, and what would change the picture.",
  "",
  "Do NOT give a buy or sell recommendation. You are not a financial advisor; this is informational only.",
  "",
  "After the three sections, output a single fenced ```json code block mirroring your analysis, using",
  "exactly these keys:",
  "",
  '```json',
  '{ "community": "…", "news": "…", "watchOuts": "…" }',
  '```',
].join("\n");

export function buildClipboardPayload(input: BriefingInput): string {
  return `${EXPORT_PROMPT}\n\n${assembleBriefing(input)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/briefing.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefing.ts src/lib/briefing.test.ts
git commit -m "feat(briefing): assemble Markdown briefing + export prompt + clipboard payload"
```
(Commit messages in this repo end with a trailing line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

### Task 2: "Copy briefing for AI" button in the Side Panel

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/sidePanel.css`
- Modify: `src/content/SidePanel.test.tsx`
- Modify: `src/content/index.tsx` (temporary stub props only — real wiring is Task 3)

- [ ] **Step 1: Write the failing test** — in `src/content/SidePanel.test.tsx`:

(a) Add two fields to the `defaults` object (after `onTradingViewClick: () => {},`):
```ts
  copyState: "idle" as "idle" | "copied" | "error",
  onCopyBriefing: () => {},
```
(b) Append these tests inside `describe("<SidePanel />", …)`:
```ts
  it("renders the copy-briefing button when the ticker is resolved", () => {
    const { container } = render(<SidePanel {...defaults} />);
    expect(container.querySelector(".ape-intel-briefing__copy")).toBeTruthy();
  });

  it("hides the copy-briefing button when the ticker is unresolved", () => {
    const { container } = render(<SidePanel {...defaults} ticker={null} />);
    expect(container.querySelector(".ape-intel-briefing__copy")).toBeNull();
  });

  it("invokes onCopyBriefing when the button is clicked", () => {
    const onCopyBriefing = vi.fn();
    const { container } = render(<SidePanel {...defaults} onCopyBriefing={onCopyBriefing} />);
    fireEvent.click(container.querySelector(".ape-intel-briefing__copy")!);
    expect(onCopyBriefing).toHaveBeenCalledTimes(1);
  });

  it("shows a Copied! label when copyState is copied", () => {
    const { getByText } = render(<SidePanel {...defaults} copyState="copied" />);
    expect(getByText("Copied!")).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `copyState`/`onCopyBriefing` not props; no `.ape-intel-briefing__copy`.

- [ ] **Step 3: Write minimal implementation** — in `src/content/SidePanel.tsx`:

(a) Add two fields to `SidePanelProps` (after `history: DailySnapshot[] | null | undefined;`):
```tsx
  copyState: "idle" | "copied" | "error";
  onCopyBriefing: () => void;
```
(b) Add the two fields to the destructured params (extend the `isFavourite, showCapHint, onToggleFavourite, history,` line so it reads):
```tsx
  isFavourite, showCapHint, onToggleFavourite, history, copyState, onCopyBriefing,
```
(c) Render the section just before `<ExternalLinksBar … />` (i.e. after the `{ticker && isFavourite ? <SparklineSection … /> : null}` line):
```tsx
      {ticker ? (
        <section class="ape-intel-panel__source ape-intel-briefing">
          <h3 class="ape-intel-panel__section-title">AI Briefing</h3>
          <button type="button" class="ape-intel-briefing__copy" onClick={onCopyBriefing}>
            {copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy briefing for AI"}
          </button>
        </section>
      ) : null}
```

- [ ] **Step 4: Append CSS to `src/content/sidePanel.css`:**

```css
.ape-intel-briefing__copy {
  padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
  background: #4ade80; color: #111; font-weight: 600; font-size: 12px;
}
```

- [ ] **Step 5: Add temporary stub props in `src/content/index.tsx`** so it still typechecks (real wiring lands in Task 3). In the `<SidePanel … />` JSX, after the `history={currentHistory}` line, add:
```tsx
        copyState="idle"
        onCopyBriefing={() => {}}
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS (existing + 4 new).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/content/SidePanel.tsx src/content/sidePanel.css src/content/SidePanel.test.tsx src/content/index.tsx
git commit -m "feat(side-panel): Copy briefing for AI button"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

### Task 3: Wire clipboard copy in the content script

**Files:**
- Modify: `src/content/index.tsx`

> No unit test (orchestration layer); verified via typecheck + full suite + build + manual clipboard check.

- [ ] **Step 1: Add the import** — after `import { aggregate as computeAggregate } from "../lib/barometer";` add:
```tsx
import { buildClipboardPayload } from "../lib/briefing";
```

- [ ] **Step 2: Add module state** — after `let currentHistory: DailySnapshot[] | null | undefined = undefined;` add:
```tsx
let copyState: "idle" | "copied" | "error" = "idle";
```

- [ ] **Step 3: Replace the temporary stub props** in the `<SidePanel … />` JSX (the `copyState="idle"` / `onCopyBriefing={() => {}}` lines from Task 2) with:
```tsx
        copyState={copyState}
        onCopyBriefing={onCopyBriefing}
```

- [ ] **Step 4: Add the handler** — after the `onSaveKey` function definition, add:
```tsx
function onCopyBriefing(): void {
  if (typeof currentTicker !== "string") return;
  const payload = buildClipboardPayload({
    ticker: currentTicker,
    aggregate: currentAggregate(),
    apewisdom: currentApewisdom,
    stocktwits: currentStockTwits,
    news: currentNews,
    earnings: currentEarnings,
  });
  navigator.clipboard.writeText(payload).then(
    () => { copyState = "copied"; paint(); },
    (e) => { console.warn("[ape-intel] clipboard write failed", e); copyState = "error"; paint(); },
  );
}
```

- [ ] **Step 5: Reset copyState on navigation** — in the `observeIsin` reset block, after `currentHistory = undefined;` add:
```tsx
  copyState = "idle";
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification (Firefox)**

1. `npm run build`, then `about:debugging` → This Firefox → reload the add-on from `dist/manifest.json`; reload a Scalable security page.
2. Open a US-listed stock, open the Side Panel → an "AI Briefing" section with a "Copy briefing for AI" button appears.
3. Click it → label flips to "Copied!". Paste into a text editor: the Export Prompt is at the top, a blank line, then the Markdown briefing (Asset / Barometer / Buzz & Trend / Community / Earnings / News).
4. SPA-navigate to another stock → the button resets to "Copy briefing for AI".

- [ ] **Step 8: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat(content): wire Copy briefing for AI to the clipboard"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

## Self-Review notes

- **Spec coverage:** Briefing assembly from available data with explicit empty states (Task 1, §4); fixed hybrid Export Prompt with 3 blocks + buy/sell prohibition + fenced-json instruction (Task 1, §5); `buildClipboardPayload` (Task 1); Side Panel "Copy briefing for AI" button gated on ticker + copyState feedback (Task 2, §6); content clipboard wiring + copyState reset on navigation + manual verification (Task 3, §6). All design sections covered.
- **Type consistency:** `BriefingInput`, `assembleBriefing`, `EXPORT_PROMPT`, `buildClipboardPayload`, the `copyState: "idle" | "copied" | "error"` union, and the SidePanel props `copyState`/`onCopyBriefing` are identical across Tasks 1–3. `BriefingInput.aggregate` is `Aggregate | null | undefined`; `currentAggregate()` returns `Aggregate | undefined`, which is assignable.
- **Scope honored:** no API key, no provider adapter, no re-ingestion/parsing, no Settings editor, no Medium/Deep-dive toggle, Tradestie excluded — all deferred per the design.
- **Stub bridge:** Task 2 adds temporary `copyState="idle"`/`onCopyBriefing={() => {}}` stub props so the content script typechecks between tasks; Task 3 replaces them with the real state + handler.
```

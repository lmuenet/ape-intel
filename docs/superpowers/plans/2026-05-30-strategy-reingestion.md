# Strategy Re-Ingestion + Visualisation (Step 7c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user paste an LLM's full reply into the Side Panel; extract and parse the fenced `json` strategy block; persist the latest strategy per asset in `storage.local` with a timestamp; and render it.

**Architecture:** A pure lib (`strategy.ts`) extracts + parses + validates the strategy. A `StrategySection` Preact component renders either a paste form or the parsed strategy. The content layer persists via the existing `store` (`browserStorageKvStore`) under `strategy:<isin>` — no new background message type, mirroring how the Finnhub key is already handled.

**Tech Stack:** TypeScript, Preact, Vitest, `@testing-library/preact`. Runner: `npm test`; single file: `npx vitest run <path>`; types: `npm run typecheck`; build: `npm run build`.

**Design doc:** `docs/superpowers/specs/2026-05-30-strategy-reingestion-design.md`. The strategy JSON schema is fixed by ADR-0005 (`docs/adr/0005-export-prompt-solicits-trading-strategy.md`).

---

### Task 1: Strategy parser lib

**Files:**
- Create: `src/lib/strategy.ts`
- Test: `src/lib/strategy.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/strategy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseStrategy } from "./strategy";

const reply = (jsonLine: string): string =>
  ["Here is my analysis with lots of prose.", "```json", jsonLine, "```", "Hope that helps!"].join("\n");

describe("parseStrategy", () => {
  it("extracts and parses the fenced json block out of a full reply", () => {
    const out = parseStrategy(reply('{ "direction": "long", "timeframe": "2-4 weeks", "targetPrice": "150", "leverage": "2x", "rationale": "momentum" }'));
    expect(out).toEqual({
      direction: "long", timeframe: "2-4 weeks", targetPrice: "150", leverage: "2x", rationale: "momentum",
    });
  });

  it("returns only the keys that are present (tolerates missing)", () => {
    const out = parseStrategy(reply('{ "direction": "short" }'));
    expect(out).toEqual({ direction: "short" });
  });

  it("ignores unknown keys", () => {
    const out = parseStrategy(reply('{ "direction": "long", "foo": "bar" }'));
    expect(out).toEqual({ direction: "long" });
  });

  it("coerces non-string values to strings", () => {
    const out = parseStrategy(reply('{ "targetPrice": 150, "leverage": 3 }'));
    expect(out).toEqual({ targetPrice: "150", leverage: "3" });
  });

  it("parses bare JSON with no code fence", () => {
    expect(parseStrategy('{ "direction": "short" }')).toEqual({ direction: "short" });
  });

  it("returns null when there is no json and no bare object", () => {
    expect(parseStrategy("just some prose, nothing structured here")).toBeNull();
  });

  it("returns null for broken json in the fence", () => {
    expect(parseStrategy(reply("{ not valid json }"))).toBeNull();
  });

  it("returns null when the json is an array, not an object", () => {
    expect(parseStrategy(reply('["long", "short"]'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy.test.ts`
Expected: FAIL — cannot find module `./strategy`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/strategy.ts`:

```ts
export interface Strategy {
  direction?: string;
  timeframe?: string;
  targetPrice?: string;
  stopLoss?: string;
  leverage?: string;
  instruments?: string;
  positionSizing?: string;
  barometerCritique?: string;
  rationale?: string;
  risks?: string;
}

export interface StoredStrategy extends Strategy {
  ingestedAt: string; // ISO timestamp
}

const KEYS: (keyof Strategy)[] = [
  "direction", "timeframe", "targetPrice", "stopLoss", "leverage",
  "instruments", "positionSizing", "barometerCritique", "rationale", "risks",
];

function extractJson(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  return null;
}

export function parseStrategy(text: string): Strategy | null {
  const json = extractJson(text);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  const strategy: Strategy = {};
  for (const key of KEYS) {
    const v = obj[key];
    if (v !== undefined && v !== null) {
      strategy[key] = typeof v === "string" ? v : String(v);
    }
  }
  return strategy;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy.ts src/lib/strategy.test.ts
git commit -m "feat(strategy): parse a trading strategy out of an LLM reply's json block"
```
(Commit messages in this repo end with a trailing line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

### Task 2: StrategySection component

**Files:**
- Create: `src/content/StrategySection.tsx`
- Modify: `src/content/sidePanel.css`
- Test: `src/content/StrategySection.test.tsx`

- [ ] **Step 1: Write the failing test** — create `src/content/StrategySection.test.tsx`:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredStrategy } from "../lib/strategy";
import { StrategySection } from "./StrategySection";

afterEach(cleanup);

const stored = (o: Partial<StoredStrategy> = {}): StoredStrategy => ({
  direction: "long",
  timeframe: "2-4 weeks",
  targetPrice: "150",
  ingestedAt: "2026-05-30T14:00:00.000Z",
  ...o,
});

describe("<StrategySection />", () => {
  it("shows the paste form when there is no strategy", () => {
    const { getByPlaceholderText } = render(
      <StrategySection strategy={null} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByPlaceholderText("Paste the AI's full answer here")).toBeTruthy();
  });

  it("calls onSaveStrategy with the trimmed textarea value on submit", () => {
    const onSaveStrategy = vi.fn();
    const { getByPlaceholderText, getByText } = render(
      <StrategySection strategy={null} parseError={false} onSaveStrategy={onSaveStrategy} onClearStrategy={vi.fn()} />,
    );
    fireEvent.input(getByPlaceholderText("Paste the AI's full answer here"), { target: { value: "  raw answer  " } });
    fireEvent.click(getByText("Save strategy"));
    expect(onSaveStrategy).toHaveBeenCalledWith("raw answer");
  });

  it("shows an error line when parseError is true", () => {
    const { getByText } = render(
      <StrategySection strategy={null} parseError onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByText(/Couldn't read a strategy/i)).toBeTruthy();
  });

  it("renders the strategy fields, direction and ingested time when present", () => {
    const { getByText, container } = render(
      <StrategySection strategy={stored()} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByText("long")).toBeTruthy();
    expect(getByText("2-4 weeks")).toBeTruthy();
    expect(getByText("150")).toBeTruthy();
    expect(getByText(/Ingested 2026-05-30 14:00/)).toBeTruthy();
    expect(container.querySelector('.ape-intel-strategy__direction[data-direction="long"]')).toBeTruthy();
  });

  it("marks a short direction with the short data attribute", () => {
    const { container } = render(
      <StrategySection strategy={stored({ direction: "Short" })} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(container.querySelector('.ape-intel-strategy__direction[data-direction="short"]')).toBeTruthy();
  });

  it("calls onClearStrategy when Clear is clicked", () => {
    const onClearStrategy = vi.fn();
    const { getByText } = render(
      <StrategySection strategy={stored()} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={onClearStrategy} />,
    );
    fireEvent.click(getByText("Clear"));
    expect(onClearStrategy).toHaveBeenCalledTimes(1);
  });

  it("shows Loading when strategy is undefined", () => {
    const { getByText } = render(
      <StrategySection strategy={undefined} parseError={false} onSaveStrategy={vi.fn()} onClearStrategy={vi.fn()} />,
    );
    expect(getByText(/Loading/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/StrategySection.test.tsx`
Expected: FAIL — cannot find module `./StrategySection`.

- [ ] **Step 3: Write minimal implementation** — create `src/content/StrategySection.tsx`:

```tsx
import type { StoredStrategy } from "../lib/strategy";

export interface StrategySectionProps {
  strategy: StoredStrategy | null | undefined;
  parseError: boolean;
  onSaveStrategy: (raw: string) => void;
  onClearStrategy: () => void;
}

function ingestedLabel(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function directionKind(direction: string): "long" | "short" | "stay-out" {
  const d = direction.toLowerCase();
  if (d.includes("short")) return "short";
  if (d.includes("long")) return "long";
  return "stay-out";
}

function StrategyForm({ parseError, onSaveStrategy }: { parseError: boolean; onSaveStrategy: (raw: string) => void }) {
  const onSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const ta = form.elements.namedItem("strategyText") as HTMLTextAreaElement | null;
    const value = ta?.value.trim() ?? "";
    if (value) onSaveStrategy(value);
  };
  return (
    <form class="ape-intel-strategy__form" onSubmit={onSubmit}>
      <textarea
        name="strategyText"
        class="ape-intel-strategy__input"
        rows={4}
        placeholder="Paste the AI's full answer here"
      />
      <button type="submit" class="ape-intel-strategy__save">Save strategy</button>
      {parseError ? <p class="ape-intel-panel__placeholder">Couldn't read a strategy from that text.</p> : null}
    </form>
  );
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div class="ape-intel-strategy__field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function StrategySection({ strategy, parseError, onSaveStrategy, onClearStrategy }: StrategySectionProps) {
  return (
    <section class="ape-intel-panel__source ape-intel-strategy">
      <h3 class="ape-intel-panel__section-title">AI Strategy</h3>
      {strategy === undefined ? <p class="ape-intel-panel__placeholder">Loading…</p>
      : !strategy ? <StrategyForm parseError={parseError} onSaveStrategy={onSaveStrategy} />
      : (
        <div class="ape-intel-strategy__view">
          {strategy.direction ? (
            <span class="ape-intel-strategy__direction" data-direction={directionKind(strategy.direction)}>
              {strategy.direction}
            </span>
          ) : null}
          <dl class="ape-intel-strategy__fields">
            <Field label="Timeframe" value={strategy.timeframe} />
            <Field label="Target" value={strategy.targetPrice} />
            <Field label="Stop" value={strategy.stopLoss} />
            <Field label="Leverage" value={strategy.leverage} />
            <Field label="Instruments" value={strategy.instruments} />
            <Field label="Position sizing" value={strategy.positionSizing} />
            <Field label="Barometer critique" value={strategy.barometerCritique} />
            <Field label="Rationale" value={strategy.rationale} />
            <Field label="Risks" value={strategy.risks} />
          </dl>
          <div class="ape-intel-strategy__footer">
            <span class="ape-intel-strategy__ingested">Ingested {ingestedLabel(strategy.ingestedAt)}</span>
            <button type="button" class="ape-intel-strategy__clear" onClick={onClearStrategy}>Clear</button>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Append CSS to `src/content/sidePanel.css`:**

```css
.ape-intel-strategy__form { display: flex; flex-direction: column; gap: 8px; }
.ape-intel-strategy__input {
  width: 100%; box-sizing: border-box; resize: vertical; padding: 6px 8px;
  border-radius: 6px; border: 1px solid #2a2a2a; background: #1a1a1a; color: inherit;
  font: inherit; font-size: 12px;
}
.ape-intel-strategy__save {
  align-self: flex-start; padding: 6px 12px; border-radius: 6px; border: none;
  cursor: pointer; background: #4ade80; color: #111; font-weight: 600; font-size: 12px;
}
.ape-intel-strategy__direction {
  display: inline-block; text-transform: uppercase; letter-spacing: 0.04em;
  font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px;
}
.ape-intel-strategy__direction[data-direction="long"] { background: #14351f; color: #4ade80; }
.ape-intel-strategy__direction[data-direction="short"] { background: #3a1620; color: #f87171; }
.ape-intel-strategy__direction[data-direction="stay-out"] { background: #232323; color: #aaa; }
.ape-intel-strategy__fields { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.ape-intel-strategy__field dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6; }
.ape-intel-strategy__field dd { margin: 0; font-size: 13px; line-height: 1.35; }
.ape-intel-strategy__footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 11px; opacity: 0.7; }
.ape-intel-strategy__clear {
  padding: 4px 10px; border-radius: 6px; border: 1px solid #2a2a2a; background: transparent;
  color: inherit; cursor: pointer; font-size: 11px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/content/StrategySection.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/StrategySection.tsx src/content/StrategySection.test.tsx src/content/sidePanel.css
git commit -m "feat(content): StrategySection — paste form + strategy view"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

### Task 3: Render StrategySection in the Side Panel

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/SidePanel.test.tsx`
- Modify: `src/content/index.tsx` (temporary stub props only — real wiring is Task 4)

- [ ] **Step 1: Write the failing test** — in `src/content/SidePanel.test.tsx`:

(a) Add four fields to the `defaults` object (after `onCopyBriefing: () => {},`):
```ts
  strategy: null as import("../lib/strategy").StoredStrategy | null | undefined,
  parseError: false,
  onSaveStrategy: (_raw: string) => {},
  onClearStrategy: () => {},
```
(b) Append these tests inside `describe("<SidePanel />", …)`:
```ts
  it("renders the AI Strategy paste form when the ticker is resolved", () => {
    const { getByPlaceholderText } = render(<SidePanel {...defaults} />);
    expect(getByPlaceholderText("Paste the AI's full answer here")).toBeTruthy();
  });

  it("hides the AI Strategy section when the ticker is unresolved", () => {
    const { queryByText } = render(<SidePanel {...defaults} ticker={null} />);
    expect(queryByText("AI Strategy")).toBeNull();
  });

  it("renders an ingested strategy's direction", () => {
    const { getByText } = render(
      <SidePanel
        {...defaults}
        strategy={{ direction: "long", timeframe: "2w", ingestedAt: "2026-05-30T14:00:00.000Z" }}
      />,
    );
    expect(getByText("long")).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `strategy`/`parseError`/`onSaveStrategy`/`onClearStrategy` not props; no "AI Strategy" section.

- [ ] **Step 3: Write minimal implementation** — in `src/content/SidePanel.tsx`:

(a) Add imports after `import type { DailySnapshot } from "../lib/snapshot-history";`:
```tsx
import { StrategySection } from "./StrategySection";
import type { StoredStrategy } from "../lib/strategy";
```
(b) Add four fields to `SidePanelProps` (after `onCopyBriefing: () => void;`):
```tsx
  strategy: StoredStrategy | null | undefined;
  parseError: boolean;
  onSaveStrategy: (raw: string) => void;
  onClearStrategy: () => void;
```
(c) Extend the destructured params line `isFavourite, showCapHint, onToggleFavourite, history, copyState, onCopyBriefing,` to also include the new fields:
```tsx
  isFavourite, showCapHint, onToggleFavourite, history, copyState, onCopyBriefing,
  strategy, parseError, onSaveStrategy, onClearStrategy,
```
(d) Render the section immediately AFTER the existing AI Briefing copy `</section>` block's closing `) : null}` and BEFORE `<ExternalLinksBar … />`:
```tsx
      {ticker ? (
        <StrategySection
          strategy={strategy}
          parseError={parseError}
          onSaveStrategy={onSaveStrategy}
          onClearStrategy={onClearStrategy}
        />
      ) : null}
```

- [ ] **Step 4: Add temporary stub props in `src/content/index.tsx`** so it still typechecks (real wiring lands in Task 4). In the `<SidePanel … />` JSX, after the `onCopyBriefing={onCopyBriefing}` line, add:
```tsx
        strategy={undefined}
        parseError={false}
        onSaveStrategy={() => {}}
        onClearStrategy={() => {}}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS (existing + 3 new).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/content/SidePanel.tsx src/content/SidePanel.test.tsx src/content/index.tsx
git commit -m "feat(side-panel): render AI Strategy section"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

### Task 4: Wire strategy load / save / clear in the content script

**Files:**
- Modify: `src/content/index.tsx`

> No unit test (orchestration layer); verified via typecheck + full suite + build + manual paste check.

- [ ] **Step 1: Add imports** — after `import { buildClipboardPayload } from "../lib/briefing";` add:
```tsx
import { parseStrategy, type StoredStrategy } from "../lib/strategy";
```

- [ ] **Step 2: Add a storage-key constant** — after the line `const FINNHUB_KEY = "finnhub:apiKey";` add:
```tsx
const STRATEGY_PREFIX = "strategy:";
```

- [ ] **Step 3: Add module state** — after `let copyState: "idle" | "copied" | "error" = "idle";` add:
```tsx
let currentStrategy: StoredStrategy | null | undefined = undefined;
let strategyError = false;
```

- [ ] **Step 4: Replace the temporary stub props** in the `<SidePanel … />` JSX (the four stub lines from Task 3) with:
```tsx
        strategy={currentStrategy}
        parseError={strategyError}
        onSaveStrategy={onSaveStrategy}
        onClearStrategy={onClearStrategy}
```

- [ ] **Step 5: Add the handlers** — after the `onCopyBriefing` function definition, add:
```tsx
function onSaveStrategy(raw: string): void {
  if (currentIsin === null) return;
  const gen = generation;
  const isin = currentIsin;
  const parsed = parseStrategy(raw);
  if (!parsed) {
    strategyError = true;
    paint();
    return;
  }
  const record: StoredStrategy = { ...parsed, ingestedAt: new Date().toISOString() };
  strategyError = false;
  currentStrategy = record;
  paint();
  store.set(`${STRATEGY_PREFIX}${isin}`, record).then(
    () => {},
    (e) => { if (gen === generation) console.warn("[ape-intel] strategy save failed", e); },
  );
}

function onClearStrategy(): void {
  if (currentIsin === null) return;
  const isin = currentIsin;
  currentStrategy = null;
  strategyError = false;
  paint();
  store.remove(`${STRATEGY_PREFIX}${isin}`);
}
```

- [ ] **Step 6: Load the stored strategy on ticker resolve** — inside the `observeIsin` success branch, in the `if (ticker) { … }` block, after the `store.get<string>(FINNHUB_KEY).then(…)` block, add:
```tsx
        store.get<StoredStrategy>(`${STRATEGY_PREFIX}${isin}`).then((s) => {
          if (gen !== generation) return;
          currentStrategy = s ?? null;
          paint();
        });
```

- [ ] **Step 7: Reset strategy state on navigation** — in the `observeIsin` reset block, after `copyState = "idle";` add:
```tsx
  currentStrategy = undefined;
  strategyError = false;
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Manual verification (Firefox)**

1. `npm run build`, reload the add-on from `dist/manifest.json`, reload a Scalable security page.
2. Open a US-listed stock, open the Side Panel → an "AI Strategy" section shows a textarea + "Save strategy".
3. Click "Copy briefing for AI", paste into an LLM, copy its full reply, paste it into the textarea, click "Save strategy" → the parsed strategy renders (direction colour-coded, timeframe/target/stop/leverage, etc.) with an "Ingested …" footer.
4. Paste garbage with no json block → "Couldn't read a strategy from that text.".
5. Reload the page / SPA-navigate away and back → the saved strategy is still shown for that asset. "Clear" removes it.

- [ ] **Step 10: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat(content): wire AI strategy load/save/clear via storage"
```
(Trailing `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` line.)

---

## Self-Review notes

- **Spec coverage:** robust json-block extraction + parsing + validation incl. bare-JSON fallback, array rejection, unknown-key drop, string coercion (Task 1, §3/§6); StrategySection paste form + rendered view + states + direction colour-coding (Task 2, §5); Side Panel integration gated on ticker (Task 3); content persistence via `store` under `strategy:<isin>` with `ingestedAt`, load/save/clear, reset on navigation, manual verification (Task 4, §3). All design sections covered.
- **Type consistency:** `Strategy` (ten optional string fields) and `StoredStrategy = Strategy & { ingestedAt: string }` are defined in `strategy.ts` and imported identically by `StrategySection.tsx`, `SidePanel.tsx`, and `index.tsx`. `parseStrategy(text): Strategy | null`. The `StrategySection` props (`strategy`, `parseError`, `onSaveStrategy`, `onClearStrategy`) match across Tasks 2–4. Storage key `strategy:<isin>` is identical in save/clear/load.
- **Scope honored:** no sharing, no model capture (only `ingestedAt`), no per-asset history, no field editing — all deferred per the design.
- **Stub bridge:** Task 3 adds temporary `strategy={undefined}` / stub handlers so the content script typechecks between tasks; Task 4 replaces them with the real state + handlers.
```

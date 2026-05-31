# AI Export Flow v2 (Paket A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the copy-out AI briefing with an explicit bull/bear reasoning step in the default prompt and a per-export, sticky Trading Profile (risk + horizon) that injects a "preference, not a command" block the LLM must validate.

**Architecture:** `lib/briefing.ts` stays pure: it gains the `TradingProfile` types, a `renderProfileBlock`, a `normalizeProfile` guard, a renamed+enriched `DEFAULT_EXPORT_PROMPT`, and a new `buildClipboardPayload(input, { basePrompt, profile })` signature. `SidePanel.tsx` renders two presentational `<select>` knobs. `content/index.tsx` reads/persists the profile and the (optional) stored base prompt and wires the new call. No Settings UI here — only the storage seam Paket B will later write.

**Tech Stack:** TypeScript, Preact, Vitest, @testing-library/preact, Firefox MV3 `browser.storage.local`.

Design reference: `docs/superpowers/specs/2026-05-31-ai-export-flow-v2-design.md`. Decision record: `docs/adr/0010-copy-out-only-ai-with-parameterised-prompt.md`.

---

## File Structure

- `src/lib/briefing.ts` (modify) — pure prompt/briefing assembly. Adds profile types + `DEFAULT_PROFILE` + `normalizeProfile` + `renderProfileBlock`; renames `EXPORT_PROMPT` → `DEFAULT_EXPORT_PROMPT` (with a bull/bear step); changes `buildClipboardPayload` signature.
- `src/lib/briefing.test.ts` (modify) — updates the renamed constant + new-signature payload test; adds profile/bull-bear tests.
- `src/content/SidePanel.tsx` (modify) — two `<select>` knobs in the "AI Briefing" section; two new props.
- `src/content/SidePanel.test.tsx` (modify) — adds the two props to `defaults`; tests the knobs.
- `src/content/sidePanel.css` (modify) — knob row styling.
- `src/content/index.tsx` (modify) — storage keys, profile state, read/persist, new `buildClipboardPayload` call, `onProfileChange`.

---

## Task 1: `lib/briefing.ts` — Trading Profile + bull/bear prompt + new payload signature

**Files:**
- Modify: `src/lib/briefing.ts`
- Test: `src/lib/briefing.test.ts`

- [ ] **Step 1: Rewrite the test file's imports and the three affected describe-blocks**

Replace the import on line 6 and the `EXPORT_PROMPT` + `buildClipboardPayload` describe-blocks (lines 68–111) with the following. Leave the `assembleBriefing` describe-block (lines 24–66) untouched.

```ts
// line 6 — replace the import
import {
  assembleBriefing,
  buildClipboardPayload,
  renderProfileBlock,
  normalizeProfile,
  DEFAULT_EXPORT_PROMPT,
  DEFAULT_PROFILE,
  type RiskAppetite,
  type BriefingInput,
} from "./briefing";
```

```ts
// replace the old `describe("EXPORT_PROMPT", ...)` and
// `describe("buildClipboardPayload", ...)` blocks with everything below:

describe("DEFAULT_EXPORT_PROMPT", () => {
  it("asks for a trading strategy on this stock", () => {
    expect(DEFAULT_EXPORT_PROMPT.toLowerCase()).toContain("trading strategy");
  });
  it("tells the model to critically challenge our barometer", () => {
    const p = DEFAULT_EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("barometer");
    expect(p).toContain("challenge");
  });
  it("asks the model to do its own independent research across many sources", () => {
    const p = DEFAULT_EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("research");
    expect(p).toContain("reddit");
    expect(p).toContain("seeking alpha");
    expect(p).toContain("r/stocks");
  });
  it("tells the model to build a bull case and a bear case before deciding", () => {
    const p = DEFAULT_EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("bull case");
    expect(p).toContain("bear case");
  });
  it("asks for a concrete recommendation with a conviction level", () => {
    const p = DEFAULT_EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("recommendation");
    expect(p).toContain("conviction");
  });
  it("requests concrete strategy parameters", () => {
    const p = DEFAULT_EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("long or short");
    expect(p).toContain("timeframe");
    expect(p).toContain("leverage");
    expect(p).toContain("position sizing");
  });
  it("requests a fenced json block mirroring the strategy", () => {
    expect(DEFAULT_EXPORT_PROMPT).toContain("```json");
    expect(DEFAULT_EXPORT_PROMPT).toContain("recommendation");
    expect(DEFAULT_EXPORT_PROMPT).toContain("conviction");
    expect(DEFAULT_EXPORT_PROMPT).toContain("direction");
    expect(DEFAULT_EXPORT_PROMPT).toContain("targetPrice");
    expect(DEFAULT_EXPORT_PROMPT).toContain("leverage");
  });
});

describe("DEFAULT_PROFILE", () => {
  it("is balanced risk on a swing horizon", () => {
    expect(DEFAULT_PROFILE).toEqual({ risk: "balanced", horizon: "swing" });
  });
});

describe("normalizeProfile", () => {
  it("passes valid profiles through unchanged", () => {
    expect(normalizeProfile({ risk: "aggressive", horizon: "position" })).toEqual({
      risk: "aggressive",
      horizon: "position",
    });
  });
  it("replaces invalid or missing fields with defaults", () => {
    expect(normalizeProfile({ risk: "nope" })).toEqual(DEFAULT_PROFILE);
    expect(normalizeProfile(undefined)).toEqual(DEFAULT_PROFILE);
    expect(normalizeProfile(null)).toEqual(DEFAULT_PROFILE);
  });
});

describe("renderProfileBlock", () => {
  it("renders the chosen risk and horizon labels", () => {
    const out = renderProfileBlock({ risk: "aggressive", horizon: "intraday" });
    expect(out).toContain("Risk appetite: aggressive");
    expect(out).toContain("Preferred horizon: intraday / day-trade");
  });
  it("frames the profile as a preference to validate, not a command", () => {
    const out = renderProfileBlock({ risk: "balanced", horizon: "swing" }).toLowerCase();
    expect(out).toContain("preference");
    expect(out).toContain("stay out");
  });
  it("falls back to defaults for an unknown field value", () => {
    const out = renderProfileBlock({ risk: "yolo" as RiskAppetite, horizon: "swing" });
    expect(out).toContain("Risk appetite: balanced");
  });
});

describe("buildClipboardPayload", () => {
  it("is the base prompt, the profile block, then the briefing", () => {
    const input = full();
    const profile = { risk: "balanced", horizon: "swing" } as const;
    expect(buildClipboardPayload(input, { basePrompt: "BASE", profile })).toBe(
      `BASE\n\n${renderProfileBlock(profile)}\n\n${assembleBriefing(input)}`,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/briefing.test.ts`
Expected: FAIL — `renderProfileBlock`, `normalizeProfile`, `DEFAULT_EXPORT_PROMPT`, `DEFAULT_PROFILE` are not exported; `buildClipboardPayload` arity mismatch.

- [ ] **Step 3: Add the profile types, guards, `DEFAULT_PROFILE`, `normalizeProfile`, and `renderProfileBlock`**

In `src/lib/briefing.ts`, immediately above the existing `export const EXPORT_PROMPT = [` line, insert:

```ts
export type RiskAppetite = "conservative" | "balanced" | "aggressive";
export type Horizon = "intraday" | "swing" | "position";
export interface TradingProfile {
  risk: RiskAppetite;
  horizon: Horizon;
}

export const DEFAULT_PROFILE: TradingProfile = { risk: "balanced", horizon: "swing" };

const RISKS: RiskAppetite[] = ["conservative", "balanced", "aggressive"];
const HORIZONS: Horizon[] = ["intraday", "swing", "position"];
const isRisk = (v: unknown): v is RiskAppetite => RISKS.includes(v as RiskAppetite);
const isHorizon = (v: unknown): v is Horizon => HORIZONS.includes(v as Horizon);

/** Coerce a possibly hand-edited stored value into a valid TradingProfile. */
export function normalizeProfile(raw: unknown): TradingProfile {
  const r = (raw ?? {}) as { risk?: unknown; horizon?: unknown };
  return {
    risk: isRisk(r.risk) ? r.risk : DEFAULT_PROFILE.risk,
    horizon: isHorizon(r.horizon) ? r.horizon : DEFAULT_PROFILE.horizon,
  };
}

const RISK_LABEL: Record<RiskAppetite, string> = {
  conservative: "conservative",
  balanced: "balanced",
  aggressive: "aggressive",
};
const HORIZON_LABEL: Record<Horizon, string> = {
  intraday: "intraday / day-trade",
  swing: "swing (days–weeks)",
  position: "position (months)",
};

/**
 * The "Trading profile" block injected between the base prompt and the Briefing.
 * Defensive: normalises its input so a bad stored value can never break export.
 */
export function renderProfileBlock(profile: TradingProfile): string {
  const { risk, horizon } = normalizeProfile(profile);
  return [
    "## My trading profile (preference, not an instruction)",
    `- Risk appetite: ${RISK_LABEL[risk]}`,
    `- Preferred horizon: ${HORIZON_LABEL[horizon]}`,
    "",
    "Treat the profile above as my leaning, not a constraint. First judge whether this",
    "risk/horizon profile actually makes sense for THIS stock right now, given the",
    "briefing below and your own research.",
    "- If it fits: build the concrete plan around it.",
    "- If it does not fit: say so plainly, explain why, and propose the profile that",
    "  does fit instead.",
    "Provide concrete numeric levels (entry, target(s), stop / invalidation, sizing,",
    "leverage) ONLY for a strategy you genuinely believe has an edge. If the honest",
    'answer is no trade, say "stay out" — and do not invent levels.',
  ].join("\n");
}
```

- [ ] **Step 4: Rename the prompt constant and add the bull/bear step**

Rename `export const EXPORT_PROMPT = [` to `export const DEFAULT_EXPORT_PROMPT = [`. Then, inside the array, insert a bull/bear instruction between the end of research item `3.` and the start of item `4.`. Locate these two existing adjacent lines:

```ts
      "   data alone.",
      "4. Then give me a concrete short-to-medium-term trading strategy, including:",
```

Insert three new lines plus a blank-line marker between them so the block reads:

```ts
      "   data alone.",
      "",
      "Before you commit to a view, build the STRONGEST bull case AND the STRONGEST bear",
      "case for this stock over the chosen horizon. Steelman both sides — do not strawman",
      "the side you lean against. Only then weigh them against each other and decide.",
      "4. Then give me a concrete short-to-medium-term trading strategy, including:",
```

- [ ] **Step 5: Change the `buildClipboardPayload` signature**

Replace the existing function (currently the last export in the file):

```ts
export function buildClipboardPayload(input: BriefingInput): string {
  return `${EXPORT_PROMPT}\n\n${assembleBriefing(input)}`;
}
```

with:

```ts
export function buildClipboardPayload(
  input: BriefingInput,
  options: { basePrompt: string; profile: TradingProfile },
): string {
  return `${options.basePrompt}\n\n${renderProfileBlock(options.profile)}\n\n${assembleBriefing(input)}`;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/briefing.test.ts`
Expected: PASS (all `assembleBriefing`, `DEFAULT_EXPORT_PROMPT`, `DEFAULT_PROFILE`, `normalizeProfile`, `renderProfileBlock`, `buildClipboardPayload` tests green).

- [ ] **Step 7: Commit**

```bash
git add src/lib/briefing.ts src/lib/briefing.test.ts
git commit -m "feat(briefing): trading-profile block + bull/bear prompt + payload override seam"
```

---

## Task 2: `SidePanel.tsx` — risk/horizon knobs in the AI Briefing section

**Files:**
- Modify: `src/content/SidePanel.tsx`
- Modify: `src/content/sidePanel.css`
- Test: `src/content/SidePanel.test.tsx`

- [ ] **Step 1: Add the two props to the test `defaults` and write the failing tests**

In `src/content/SidePanel.test.tsx`, add these two entries to the `defaults` object (e.g. after `refreshDisabledUntil`):

```ts
  profile: { risk: "balanced", horizon: "swing" } as import("../lib/briefing").TradingProfile,
  onProfileChange: (_p: import("../lib/briefing").TradingProfile) => {},
```

Then add this describe-block at the end of the file (before the final closing `});` of the outer `describe`, or as a new top-level `describe`):

```ts
describe("<SidePanel /> trading-profile knobs", () => {
  it("reflects the current profile in the selects", () => {
    const { getByLabelText } = render(
      <SidePanel {...defaults} profile={{ risk: "aggressive", horizon: "intraday" }} />,
    );
    expect((getByLabelText("Risk appetite") as HTMLSelectElement).value).toBe("aggressive");
    expect((getByLabelText("Horizon") as HTMLSelectElement).value).toBe("intraday");
  });

  it("fires onProfileChange with the updated profile when a knob changes", () => {
    const onProfileChange = vi.fn();
    const { getByLabelText } = render(
      <SidePanel
        {...defaults}
        profile={{ risk: "balanced", horizon: "swing" }}
        onProfileChange={onProfileChange}
      />,
    );
    fireEvent.change(getByLabelText("Horizon"), { target: { value: "position" } });
    expect(onProfileChange).toHaveBeenCalledWith({ risk: "balanced", horizon: "position" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: FAIL — `getByLabelText("Risk appetite")` finds no element (and a TS error on the unknown `profile`/`onProfileChange` props until Step 3).

- [ ] **Step 3: Add the props and the import to `SidePanel.tsx`**

Add the import near the other type imports (after line 13):

```ts
import type { TradingProfile, RiskAppetite, Horizon } from "../lib/briefing";
```

Add to `SidePanelProps` (after `onCopyBriefing` on line 30):

```ts
  profile: TradingProfile;
  onProfileChange: (profile: TradingProfile) => void;
```

Add `profile` and `onProfileChange` to the destructured parameter list of the `SidePanel` function (wherever the other props are destructured).

- [ ] **Step 4: Render the knobs in the AI Briefing section**

Replace the existing AI Briefing `<section>` (lines 200–207) with:

```tsx
      {ticker ? (
        <section class="ape-intel-panel__source ape-intel-briefing">
          <h3 class="ape-intel-panel__section-title">AI Briefing</h3>
          <div class="ape-intel-briefing__knobs">
            <label class="ape-intel-briefing__knob">
              <span>Risk</span>
              <select
                aria-label="Risk appetite"
                value={profile.risk}
                onChange={(e) =>
                  onProfileChange({ ...profile, risk: (e.currentTarget as HTMLSelectElement).value as RiskAppetite })
                }
              >
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </label>
            <label class="ape-intel-briefing__knob">
              <span>Horizon</span>
              <select
                aria-label="Horizon"
                value={profile.horizon}
                onChange={(e) =>
                  onProfileChange({ ...profile, horizon: (e.currentTarget as HTMLSelectElement).value as Horizon })
                }
              >
                <option value="intraday">Intraday</option>
                <option value="swing">Swing</option>
                <option value="position">Position</option>
              </select>
            </label>
          </div>
          <button type="button" class="ape-intel-briefing__copy" onClick={onCopyBriefing}>
            {copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy briefing for AI"}
          </button>
        </section>
      ) : null}
```

- [ ] **Step 5: Add knob styling**

Append to `src/content/sidePanel.css`:

```css
.ape-intel-briefing__knobs {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.ape-intel-briefing__knob {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}
.ape-intel-briefing__knob select {
  font: inherit;
  padding: 2px 4px;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/content/SidePanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/content/SidePanel.tsx src/content/SidePanel.test.tsx src/content/sidePanel.css
git commit -m "feat(side-panel): risk/horizon trading-profile knobs in AI Briefing"
```

---

## Task 3: `content/index.tsx` — persist the profile and wire the new payload

**Files:**
- Modify: `src/content/index.tsx`

(No unit test: `index.tsx` is the orchestration layer and has no test file in this project. Coverage is the `lib`/`SidePanel` tests above plus the full suite + typecheck + a manual smoke.)

- [ ] **Step 1: Extend the briefing import**

Change line 13 from:

```ts
import { buildClipboardPayload } from "../lib/briefing";
```

to:

```ts
import { buildClipboardPayload, normalizeProfile, DEFAULT_EXPORT_PROMPT, DEFAULT_PROFILE, type TradingProfile } from "../lib/briefing";
```

- [ ] **Step 2: Add the storage-key constants**

After line 34 (`const REFRESH_PREFIX = "refresh:";`) add:

```ts
const PROFILE_KEY = "export:profile";
const PROMPT_KEY = "export:prompt";
```

- [ ] **Step 3: Add profile state and load it once at module init**

After line 91 (`let currentStrategy: ...`) add:

```ts
// Global (not per-Asset) export profile; sticky in storage.local.
let currentProfile: TradingProfile = DEFAULT_PROFILE;
void store.get<unknown>(PROFILE_KEY).then((p) => { currentProfile = normalizeProfile(p); paint(); });
```

- [ ] **Step 4: Add the `onProfileChange` handler and rewrite `onCopyBriefing`**

Replace the existing `onCopyBriefing` (lines 214–228) with:

```ts
function onProfileChange(profile: TradingProfile): void {
  currentProfile = profile;
  paint();
  void store.set(PROFILE_KEY, profile).catch((e) => log.warn("profile save failed", e));
}

function onCopyBriefing(): void {
  if (typeof currentTicker !== "string") return;
  const ticker = currentTicker;
  void store.get<string>(PROMPT_KEY).then((storedPrompt) => {
    const payload = buildClipboardPayload(
      {
        ticker,
        aggregate: currentAggregate(),
        apewisdom: currentApewisdom,
        stocktwits: currentStockTwits,
        news: currentNews,
        earnings: currentEarnings,
      },
      { basePrompt: storedPrompt ?? DEFAULT_EXPORT_PROMPT, profile: currentProfile },
    );
    navigator.clipboard.writeText(payload).then(
      () => { copyState = "copied"; paint(); },
      (e) => { log.warn("clipboard write failed", e); copyState = "error"; paint(); },
    );
  });
}
```

- [ ] **Step 5: Pass the new props to `<SidePanel>`**

In the `paint()` render, after `onCopyBriefing={onCopyBriefing}` (line 145) add:

```tsx
        profile={currentProfile}
        onProfileChange={onProfileChange}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run test`
Expected: PASS (entire suite).

- [ ] **Step 7: Manual smoke test**

Run: `npm run build`, load the extension in Firefox (`about:debugging` → Temporary Add-on), open a Scalable security page, open the Side Panel:
- The "AI Briefing" section shows Risk + Horizon selects defaulting to Balanced / Swing.
- Change both, click "Copy briefing for AI", paste somewhere: the payload contains `## My trading profile`, the chosen labels, the bull/bear instruction, then the `# Ape Intel Briefing` section.
- Reopen the panel (or reload): the selects retain the last-chosen values (sticky).

- [ ] **Step 8: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat(content): persist export profile, inject profile + base-prompt override on copy"
```

---

## Self-Review notes

- **Spec coverage:** bull/bear (Task 1 Step 4 + test), Trading Profile type/default/normalize/block (Task 1), `buildClipboardPayload` override seam (Task 1 Step 5), sticky knobs (Task 2 + Task 3), storage keys `export:profile` + `export:prompt`-read (Task 3), defaults Balanced/Swing (Task 1 `DEFAULT_PROFILE`), malformed-store fallback (`normalizeProfile`, Task 1). `export:prompt` is read but never written here — by design (Paket B writes it).
- **No new JSON keys / `strategy.ts` untouched:** confirmed — bull/bear is prose only.
- **Type consistency:** `TradingProfile`, `RiskAppetite`, `Horizon`, `DEFAULT_PROFILE`, `normalizeProfile`, `renderProfileBlock`, `DEFAULT_EXPORT_PROMPT`, and `buildClipboardPayload(input, { basePrompt, profile })` are used identically across `briefing.ts`, `SidePanel.tsx`, and `index.tsx`.

# AI Export Flow v2 (Paket A) — Design

Status: Accepted
Date: 2026-05-31

Implements the export-side of the v1 finish line under **ADR-0010** (v1 AI path is
copy-out only with a parameterised prompt). Upgrades the existing "Copy briefing
for AI" flow (Step 7a, `lib/briefing.ts`) with two things: an explicit bull/bear
reasoning structure in the default prompt, and a per-export **Trading Profile**
(risk + horizon) the user sets in the Side Panel. Companion to **Paket B**
(Settings / Options page), which later exposes the *base prompt* as an editable
template; this package introduces the stored-prompt override mechanism Paket B
edits, but ships no Settings UI itself.

---

## 1. Goal

Make the copy-out briefing materially smarter without adding any provider, key, or
cost:

1. The default Export Prompt makes the LLM build the strongest **bull case** and
   **bear case** before concluding (distilled from multi-agent trading frameworks
   like TradingAgents — the reasoning structure, not the orchestration).
2. The user picks a **risk appetite** and **horizon** per export; these inject a
   "Trading Profile" block that the LLM treats as a *preference to validate*, not a
   command — concrete levels only for a strategy with a real edge, otherwise
   "stay out".

## 2. Scope boundaries

**In scope:**
- Enrich the default Export Prompt with a bull/bear reasoning step (prose only).
- `TradingProfile` type + a pure `renderProfileBlock` producing the injected block.
- `buildClipboardPayload` composes `basePrompt + profileBlock + briefing`.
- A stored base-prompt override mechanism: `buildClipboardPayload` accepts the base
  prompt as a parameter; the content layer resolves `stored ?? DEFAULT_EXPORT_PROMPT`.
- Two sticky risk/horizon selects in the Side Panel "AI Briefing" section,
  persisted to `storage.local`.

**Out of scope:**
- Any Settings / Options-page UI, including the Export-Prompt **editor** — Paket B.
  (This package only makes the prompt *overridable* via a storage key; nothing
  writes that key yet.)
- JSON-schema changes. The bull/bear debate feeds the existing strategy fields
  (`rationale`, `risks`, `barometerCritique`); `lib/strategy.ts` and
  `StrategySection` are untouched.
- In-panel BYOK, provider keys, active-provider, Medium/Deep depth — out of v1 per
  ADR-0010.

## 3. Architecture / module layout

Follows the established pattern: a pure lib produces text; the content layer does
storage + clipboard I/O; the Side Panel renders controls. `lib/briefing.ts` stays
pure (no `browser.storage` access) so it remains fully unit-testable.

- `src/lib/briefing.ts` (pure):
  - `DEFAULT_EXPORT_PROMPT: string` — renamed from `EXPORT_PROMPT`, with the new
    bull/bear step (§5). The old name is fully replaced (no consumer outside this
    package keeps it; the content layer resolves the base prompt by name below).
  - `TradingProfile` — `{ risk: RiskAppetite; horizon: Horizon }`.
    - `RiskAppetite = "conservative" | "balanced" | "aggressive"`
    - `Horizon = "intraday" | "swing" | "position"`
  - `DEFAULT_PROFILE: TradingProfile` — `{ risk: "balanced", horizon: "swing" }`.
  - `renderProfileBlock(profile: TradingProfile): string` — the injected
    "Trading profile" block + validation guardrail (§5).
  - `buildClipboardPayload(input, options): string` — **signature change**:
    `buildClipboardPayload(input: BriefingInput, options: { basePrompt: string; profile: TradingProfile })`
    returns `` `${options.basePrompt}\n\n${renderProfileBlock(options.profile)}\n\n${assembleBriefing(input)}` ``.

- `src/content/index.tsx` (orchestration):
  - On copy (`onCopyBriefing`): read `export:prompt` and `export:profile` from
    `storage.local` via the existing `browserStorageKvStore`; resolve
    `basePrompt = stored ?? DEFAULT_EXPORT_PROMPT`,
    `profile = stored ?? DEFAULT_PROFILE`; call `buildClipboardPayload`; write to
    clipboard (existing `copyState` machinery unchanged).
  - On panel mount: read `export:profile` into state so the selects reflect the
    sticky value; default to `DEFAULT_PROFILE` when absent.
  - On select change: update state and write the new `export:profile` immediately
    (fire-and-forget, like the existing challenge persistence in the popup).

- `src/content/SidePanel.tsx` (presentation):
  - The "AI Briefing" section gains two `<select>` controls (Risk, Horizon) above
    the existing "Copy briefing for AI" button. New props:
    `profile: TradingProfile`, `onProfileChange: (p: TradingProfile) => void`.
    Pure/presentational — no storage access here.

## 4. Storage keys

Both optional; a missing key falls back to its default. Bounded, single values —
no growth concern (consistent with the PRD §7 storage budget).

| Key             | Shape                          | Default            | Written by        |
|-----------------|--------------------------------|--------------------|-------------------|
| `export:prompt` | `string` (base template)       | `DEFAULT_EXPORT_PROMPT` | Paket B (editor) — not this package |
| `export:profile`| `{ risk, horizon }`            | `DEFAULT_PROFILE`  | Side Panel selects (this package) |

## 5. Prompt content

### 5a. Bull/Bear step (in `DEFAULT_EXPORT_PROMPT`)

Insert a numbered step before the strategy/recommendation step, e.g. after the
"do your own independent research" step:

> Build the **strongest bull case** and the **strongest bear case** for this stock
> over the chosen horizon — steelman both sides, do not strawman the one you lean
> against. Only then weigh them and commit to a view.

No new output keys: the resulting tension lands in the existing
`rationale` / `risks` / `barometerCritique` JSON fields. The rest of the prompt
(skeptical-analyst persona, barometer critique, JSON contract) is unchanged.

### 5b. Trading Profile block (from `renderProfileBlock`)

English (matches the base prompt), injected **between** the base prompt and the
Briefing. Risk/horizon values rendered as readable labels:

- Risk: `conservative` → "conservative", `balanced` → "balanced",
  `aggressive` → "aggressive".
- Horizon: `intraday` → "intraday / day-trade", `swing` → "swing (days–weeks)",
  `position` → "position (months)".

```
## My trading profile (preference, not an instruction)
- Risk appetite: <risk label>
- Preferred horizon: <horizon label>

Treat the profile above as my leaning, not a constraint. First judge whether this
risk/horizon profile actually makes sense for THIS stock right now, given the
briefing below and your own research.
- If it fits: build the concrete plan around it.
- If it does not fit: say so plainly, explain why, and propose the profile that
  does fit instead.
Provide concrete numeric levels (entry, target(s), stop / invalidation, sizing,
leverage) ONLY for a strategy you genuinely believe has an edge. If the honest
answer is no trade, say "stay out" — and do not invent levels.
```

The guardrail deliberately admits nonsensical combinations (e.g. conservative
intraday): two independent knobs, with the LLM as the sanity check (ADR-0010).

## 6. Error handling / edge cases

- **No stored profile / prompt:** defaults apply; copy works on a fresh install.
- **Malformed stored profile** (e.g. an unknown `risk` value from a hand-edited
  store): `renderProfileBlock` falls back per-field to the `DEFAULT_PROFILE`
  value rather than throwing, so a bad value can never break export. The Side
  Panel selects clamp to valid options on read.
- **Clipboard write failure:** unchanged — the existing `copyState: "error"` path
  already covers it.

## 7. Testing (TDD)

- `src/lib/briefing.test.ts` (extend):
  - `renderProfileBlock` renders correct labels for each risk × horizon, and the
    fixed guardrail text.
  - `renderProfileBlock` falls back to defaults for an unknown field value.
  - `buildClipboardPayload` composes `basePrompt + profileBlock + briefing` in
    that order, with the supplied base prompt (proves the override seam).
  - `DEFAULT_EXPORT_PROMPT` contains the bull/bear instruction (guards the wording
    upgrade against accidental removal).
- `src/content/SidePanel.test.tsx` (extend): the two selects render the current
  profile and fire `onProfileChange` with the updated profile on change.
- Content-layer persistence (`index.tsx`): covered at the seam where practical,
  following how the existing finnhub-key / challenge persistence is tested.

## 8. Build order (for the plan)

1. `lib/briefing.ts`: types + `DEFAULT_PROFILE` + `renderProfileBlock` + rename to
   `DEFAULT_EXPORT_PROMPT` + bull/bear wording + new `buildClipboardPayload`
   signature — red/green per test above.
2. `SidePanel.tsx`: the two selects + props (presentational).
3. `content/index.tsx`: read/resolve/persist `export:profile`, wire the new
   `buildClipboardPayload` call and `onProfileChange`.
4. Full suite green; manual smoke: change knobs, copy, inspect clipboard payload.

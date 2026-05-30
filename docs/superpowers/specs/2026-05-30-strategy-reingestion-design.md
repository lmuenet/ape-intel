# Strategy Re-Ingestion + Visualisation (Step 7c) — Design

Status: Accepted
Date: 2026-05-30

Builds directly on Step 7a (AI Briefing + Export) and **ADR-0005**: the export
prompt now asks the user's LLM to return a trading strategy mirrored in a fenced
`json` block. This step closes the loop — the user pastes the LLM's answer back
into the panel, we parse that JSON block, persist the strategy per asset, and
render it.

---

## 1. Goal

Let the user paste an LLM's full reply into the Side Panel, extract and parse
the fenced ` ```json ` strategy block, store the latest strategy per asset in
`storage.local`, and visualise it (direction, timeframe, target, stop, leverage,
instruments, position sizing, plus the critique/rationale/risks text).

## 2. Scope boundaries

**In scope:** robust JSON-block extraction + parsing; per-asset persistence with
an `ingestedAt` timestamp; a paste form + a rendered strategy view in the panel;
clear/replace.

**Out of scope (kept in mind for later):** sharing a strategy with other users;
capturing which model produced it (we cannot detect the model from a paste — only
the `ingestedAt` timestamp is captured now); a strategy history per asset (one
latest strategy replaces the previous); editing parsed fields in the UI.

## 3. Architecture / module layout

Parsing is a pure lib; the content layer persists via the existing `store`
(`browserStorageKvStore`) exactly as it already does for the Finnhub key — so no
new background message type is needed.

- `src/lib/strategy.ts` (pure, fully unit-tested):
  - `Strategy` — all ten fields optional `string`:
    `direction`, `timeframe`, `targetPrice`, `stopLoss`, `leverage`,
    `instruments`, `positionSizing`, `barometerCritique`, `rationale`, `risks`,
    plus `recommendation` and `conviction` (added by the prompt refinement — a
    one-line call + a low/medium/high conviction, rendered prominently).
  - `parseStrategy(text: string): Strategy | null` — extract the first fenced
    ` ```json … ``` ` block (fallback: try the whole trimmed text as JSON),
    `JSON.parse`, require a non-array object, copy only the known keys, coerce
    present values to `string` (e.g. a number target → its string form), drop
    unknown keys. Return `null` when no block parses or the result is not an
    object.
- `src/content/StrategySection.tsx` — the paste form **and** the rendered
  strategy view + states. + CSS + tests.
- `src/content/index.tsx` — load/save/clear via `store` with key
  `strategy:<isin>`. The stored record is
  `StoredStrategy = Strategy & { ingestedAt: string }` (ISO timestamp).

## 4. Data flow

1. When a ticker resolves, `store.get<StoredStrategy>("strategy:<isin>")` sets
   module state `currentStrategy` (`undefined` = loading, `null` = none, object
   = present). Generation-guarded like the other lookups.
2. Paste + "Save strategy" → `parseStrategy(raw)`:
   - success → `store.set("strategy:<isin>", { ...strategy, ingestedAt })` and
     render it; clear any parse error;
   - failure → set a `parseError` flag → show "Couldn't read a strategy from that
     text.".
3. "Clear" → `store.remove("strategy:<isin>")`, back to the empty form.
4. On SPA navigation, `currentStrategy` resets to `undefined` and `parseError`
   to `false` (re-fetched for the new asset).

## 5. UI

Rendered inside the existing "AI Briefing" area, only when a ticker is resolved:

- **No strategy yet:** an uncontrolled `<textarea>` (placeholder "Paste the AI's
  full answer here") in a form + a "Save strategy" button — same uncontrolled
  read-on-submit pattern as the Finnhub key form. A parse-error line shows below
  when the last attempt failed.
- **Strategy present:**
  - **Direction** emphasised and colour-coded (long = green, short = red,
    stay-out / other = grey);
  - a row: Timeframe · Target · Stop · Leverage;
  - Instruments · Position sizing;
  - longer text blocks: Barometer critique, Rationale, Risks;
  - a footer "Ingested {YYYY-MM-DD HH:mm}" + a "Clear" button (returns to the
    form).
  - Missing JSON fields are simply omitted.

## 6. Test strategy

- **`strategy.ts` (pure):**
  - extracts the JSON from a full reply with prose around the fenced block;
  - parses all ten fields;
  - tolerates missing keys (returns the present subset);
  - returns `null` for no fenced block + non-JSON text, for broken JSON, and for
    a JSON array (not an object);
  - ignores unknown keys;
  - coerces a non-string value (e.g. a numeric `targetPrice`) to a string;
  - the bare-JSON fallback parses text that is a JSON object without a fence.
- **`StrategySection`:** shows the form when no strategy; submit calls
  `onSaveStrategy(raw)` with the textarea value; shows the error line when
  `parseError`; renders the fields + "Clear" when a strategy is present; "Clear"
  calls `onClearStrategy`; direction is colour-coded via a data attribute/class.
- **Content wiring:** no unit test (orchestration) — verified via typecheck +
  full suite + build + manual paste check.

## 7. Build order (single staged plan)

1. **`strategy.ts`** — `Strategy` type + `parseStrategy` + tests.
2. **`StrategySection.tsx`** — paste form + strategy rendering + states + CSS +
   tests.
3. **Content wiring** — `currentStrategy`/`parseError` state, load/save/clear via
   `store`, reset on navigation; typecheck + build + manual verification.

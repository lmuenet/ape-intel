# Coverage States (Step 8a) — Design

Status: Accepted
Date: 2026-05-30

Implements PRD **F2** (Coverage classification) and the CONTEXT.md "Coverage"
term: every Asset is explicitly communicated as **Covered**, **Thin**, or
**Uncovered**, so empty panels are never silent/confusing. ADR-0003 requires the
state to be shown explicitly.

---

## 1. Goal

Classify each Asset's coverage from data the content script already holds, show a
compact coverage indicator on the always-visible Badge, and a labelled coverage
chip in the Side Panel header.

## 2. Classification (pure)

`src/lib/coverage.ts`:

- `type Coverage = "covered" | "thin" | "uncovered" | "unknown"`
- `interface CoverageInput { ticker: string | null | undefined; apewisdom: ApewisdomEntry | null | undefined; stocktwits: StockTwitsEntry | null | undefined; }`
- `classifyCoverage(input): Coverage`:
  - `ticker === undefined` → `"unknown"` (ticker still resolving)
  - `ticker === null` → `"uncovered"` (no US mapping: ETF / non-US listing / no OpenFIGI hit)
  - ticker is a string (resolved), but `apewisdom === undefined || stocktwits === undefined` → `"unknown"` (sources still loading — prevents a "Thin" flash before data arrives)
  - ticker resolved and both sources settled (each `null` or an entry):
    `hasChatter = (apewisdom !== null && apewisdom.mentions > 0) || (stocktwits !== null && stocktwits.totalMessages > 0)`
    → `"covered"` if `hasChatter`, else `"thin"`
- `COVERAGE_TEXT: Record<Coverage, string>` — short labels: `covered` → "Covered", `thin` → "Thin coverage", `uncovered` → "Uncovered", `unknown` → "" (not displayed).
- `COVERAGE_DETAIL: Record<Coverage, string>` — one-line explanations (see §3).

Coverage is **derived**, never stored.

## 3. Wording

- **Covered** — "US-listed with active community chatter."
- **Thin coverage** — "Mapped to a US ticker, but sources are quiet."
- **Uncovered** — "No US-ticker mapping (ETF or non-US listing) — limited data."
- **unknown** — not shown (no misleading state while loading).

## 4. UI

- **Badge** (`src/content/Badge.tsx`): a small colour-coded dot with
  `data-coverage` and `aria-label="Coverage: <label>"`. Green = covered,
  amber = thin, grey = uncovered. Hidden when `unknown`. New optional prop
  `coverage?: Coverage`.
- **Side Panel header** (`src/content/SidePanel.tsx`): a labelled chip directly
  under the title, `data-coverage`, showing the label + the §3 one-line detail.
  Hidden when `unknown`. New prop `coverage: Coverage`. It complements (does not
  replace) the existing per-source "no data" placeholders.

## 5. Architecture / module layout

- `src/lib/coverage.ts` (+ test) — pure classification + text maps.
- `src/content/Badge.tsx` (+ test, `badge.css`) — coverage dot.
- `src/content/SidePanel.tsx` (+ test, `sidePanel.css`) — coverage chip.
- `src/content/index.tsx` — a `currentCoverage()` helper (mirroring
  `currentAggregate()`) computed from `currentTicker` / `currentApewisdom` /
  `currentStockTwits`, passed to both Badge and SidePanel.

## 6. Test strategy

- **`coverage.ts`:** `unknown` for an undefined ticker; `unknown` for a resolved
  ticker while either source is undefined; `uncovered` for a null ticker; `thin`
  for a resolved ticker with both sources null; `thin` for apewisdom mentions 0 +
  stocktwits messages 0; `covered` for apewisdom mentions > 0; `covered` for
  stocktwits messages > 0; `COVERAGE_TEXT`/`COVERAGE_DETAIL` cover every variant.
- **`Badge`:** renders the dot with the right `data-coverage` + aria-label for
  covered/thin/uncovered; no dot when `unknown` / prop absent.
- **`SidePanel`:** renders the chip with label + detail + `data-coverage` for a
  covered/thin/uncovered value; no chip when `unknown`.
- **Content wiring:** no unit test (orchestration) — typecheck + full suite +
  build + manual check.

## 7. Build order (single staged plan)

1. **`coverage.ts`** — classification + text maps + tests.
2. **Badge dot** — `coverage` prop + dot + CSS + tests.
3. **Panel chip** — `coverage` prop + chip + CSS + tests + content stub prop.
4. **Content wiring** — `currentCoverage()` + pass to Badge/SidePanel; typecheck +
   build + manual verification.

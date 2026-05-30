# AI Briefing + Export (Step 7a) — Design

Status: Accepted
Date: 2026-05-30

Implements the first half of build-order Step 7 (PRD §9) and PRD **F8**
(Briefing export), grounded in **ADR-0002** (BYOK AI analysis with a Markdown
Briefing as model context). The in-panel BYOK analysis + provider adapters
(PRD F7) are deferred to a later step (7b). This step ships the Briefing and
the export-to-clipboard path, which is independently useful without any API
key — the "second consumer" of the Briefing described in CONTEXT.md / ADR-0002.

---

## 1. Goal

Assemble a human-readable Markdown **Briefing** from the data the Side Panel
already holds, and let the user copy `Export Prompt + Briefing` to the
clipboard with one click, for pasting into any external LLM (Claude.ai,
ChatGPT, Gemini). The Export Prompt instructs the LLM to return a structured,
re-ingestable answer.

## 2. Scope boundaries

**In scope:**
- Pure Briefing assembly from existing panel data.
- A fixed default Export Prompt (hybrid output format — see §5).
- A "Copy briefing for AI" action in the Side Panel writing to the clipboard.

**Out of scope (later steps):**
- In-panel BYOK AI analysis + Anthropic/OpenAI adapters + API key (Step 7b).
- Re-ingestion / visualisation of the LLM's returned analysis (its own step;
  the Export Prompt's format is designed to enable it, but no parsing is built
  here).
- Export Prompt **editor** in Settings (PRD F8 / Step 8 — the prompt is a fixed
  constant for now).
- Medium / Deep-dive depth toggle (ADR-0002): our pipeline collects only
  headlines + sentiment counts + earnings, not post/article bodies, so there is
  only one depth. Revisit if full bodies are ever fetched.

## 3. Architecture / module layout

Follows the existing pattern: a pure lib produces the text; the content layer
orchestrates clipboard I/O; the Side Panel renders the button.

- `src/lib/briefing.ts` (pure, fully unit-tested):
  - `BriefingInput` — a typed snapshot of panel data (see §4).
  - `assembleBriefing(input: BriefingInput): string` — fixed-section Markdown.
  - `EXPORT_PROMPT: string` — the fixed instruction block (§5).
  - `buildClipboardPayload(input: BriefingInput): string` —
    `` `${EXPORT_PROMPT}\n\n${assembleBriefing(input)}` ``.
- `src/content/SidePanel.tsx` — a "Copy briefing for AI" button (only when a
  ticker is resolved) plus a `copyState`-driven label.
- `src/content/index.tsx` — `onCopyBriefing()` assembles the payload from the
  current module state, calls `navigator.clipboard.writeText`, and sets a
  `copyState` ('idle' | 'copied' | 'error') for button feedback.

No new storage. No new host permission expected (clipboard write happens on a
user gesture); add `clipboardWrite` only if Firefox rejects the write.

## 4. Briefing content

`BriefingInput` is assembled from data the content script already holds:

```ts
interface BriefingInput {
  ticker: string;
  aggregate: Aggregate | null | undefined;       // ../lib/barometer
  apewisdom: ApewisdomEntry | null | undefined;   // ../lib/apewisdom
  stocktwits: StockTwitsEntry | null | undefined; // ../lib/stocktwits
  news: NewsItem[] | null | undefined;            // ../lib/finnhub
  earnings: EarningsDate | null | undefined;      // ../lib/finnhub
}
```

Fixed Markdown sections (always present, with explicit empty-state text):
1. **Asset** — the ticker.
2. **Barometer** — label + score; a low-confidence note when applicable; an
   "unavailable" line when the barometer has no data.
3. **Buzz & Trend** — buzz level + mention volume + trend direction.
4. **Community** — StockTwits (bullish / bearish / total messages) and
   Apewisdom (mentions, rank). Each source shows a "no data" line when null.
5. **Earnings** — next date + EPS estimate, or "No upcoming earnings.".
6. **News** — top headlines, each with source, date (YYYY-MM-DD) and catalyst
   tag; "No recent news." when empty.

> Tradestie is not currently wired into the live panel aggregate, so it is
> excluded from the Briefing here (no scope-creep). The Briefing reflects what
> the user actually sees in the panel.

## 5. Export Prompt (hybrid format)

A fixed constant prepended to the Briefing. It instructs the LLM to:
- act as a sober equity-research assistant, not an advisor;
- produce three readable blocks: **What the community is saying**, **What the
  news is saying**, **What to watch out for**;
- give **no** buy/sell recommendation;
- and, at the **end**, emit a single fenced ` ```json ` block mirroring the
  same analysis as a reliable parse target for later re-ingestion:
  ```json
  { "community": "...", "news": "...", "watchOuts": "..." }
  ```

The non-advice framing lives in the prompt (for the external LLM). When the
in-panel analysis is built later (7b), ADR-0002's non-advice disclaimer will be
rendered above the response in the UI.

## 6. UI & clipboard

- A small "AI Briefing" section in the Side Panel, placed after the News
  section and before the external-links bar, rendered only when a ticker is
  resolved.
- A single button labelled "Copy briefing for AI". On click, the content layer
  builds the payload and calls `navigator.clipboard.writeText(payload)`.
- Feedback via `copyState`: the label shows "Copy briefing for AI" (idle),
  "Copied!" on success, "Copy failed" on rejection. It reverts to idle on the
  next navigation.

## 7. Test strategy

- **`briefing.ts` (pure):**
  - all six sections appear for a fully-populated input;
  - empty/null states render their explicit text ("No recent news.", "No
    upcoming earnings.", an "unavailable" barometer line, per-source "no data");
  - `EXPORT_PROMPT` contains the three block names, the buy/sell prohibition,
    and the fenced-`json` instruction with the `community`/`news`/`watchOuts`
    keys;
  - `buildClipboardPayload` equals the prompt + a blank line + the briefing.
- **`SidePanel`:** the copy button renders when a ticker is present and is
  absent when the ticker is null; clicking it calls `onCopyBriefing`; the label
  shows "Copied!" when `copyState === 'copied'`.
- **Content wiring:** no unit test (orchestration) — verified via typecheck +
  full suite + build + manual clipboard check.

## 8. Build order (single staged plan)

1. **Briefing lib** — `briefing.ts` (`BriefingInput`, `assembleBriefing`,
   `EXPORT_PROMPT`, `buildClipboardPayload`) + tests.
2. **Panel button** — Side Panel "Copy briefing for AI" button + `copyState`
   feedback + tests + CSS.
3. **Content wiring** — `onCopyBriefing` clipboard write + `copyState` state;
   typecheck + build + manual verification.

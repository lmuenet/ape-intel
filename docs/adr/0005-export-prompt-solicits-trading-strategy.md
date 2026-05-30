# ADR-0005: Export prompt solicits an active trading strategy (amends ADR-0002)

Status: Accepted
Date: 2026-05-30
Amends: ADR-0002

## Context

ADR-0002 decided the AI feature would produce a sober, three-block summary
(community / news / watch-outs) and **never** a Buy/Sell recommendation, with a
non-advice disclaimer rendered above the response. PRD §2 lists "Buy/Sell
recommendations from the LLM" as an explicit non-goal.

In practice the **export** path (Step 7a) is different from the in-panel
analysis ADR-0002 was written for: the user copies a prompt + briefing into
*their own* LLM (BYOK or a free chat) and reads the answer there. For that
personal, off-extension use the owner wants an *actionable* result — a
short-to-medium-term trading view they can reason about — not a hedged summary.
A non-actionable summary makes the export far less useful for its actual job.

## Decision

For the **export prompt only**, replace the non-advice three-block framing with
a request for an **active, research-backed trading strategy**. The prompt now
asks the external LLM to:

- analyse the specific stock for a short-to-medium-term trade;
- **critically challenge** our Barometer reading rather than trust it (bias,
  small samples, hype vs. fundamentals, staleness);
- do its **own independent research** (web, news/filings, Reddit, StockTwits and
  other portals) — our briefing is only a starting point;
- return a concrete strategy: direction (long / short / stay-out), timeframe,
  target price(s) + stop, leverage suggestion + its risk, instruments
  (shares / options / leverage products) and rough position sizing;
- mirror the strategy in a fenced `json` block (keys: `direction`, `timeframe`,
  `targetPrice`, `stopLoss`, `leverage`, `instruments`, `positionSizing`,
  `barometerCritique`, `rationale`, `risks`) for later re-ingestion.

The prompt keeps a light "for my own informational research and personal
decision-making, not regulated financial advice" framing.

## Scope of this amendment

- **Changes:** the **export prompt** wording and its requested output shape
  (`src/lib/briefing.ts`, `EXPORT_PROMPT`).
- **Unchanged from ADR-0002:** providers (Anthropic + OpenAI for the future
  in-panel call), the Markdown Briefing as model context, lazy plaintext key
  storage.
- **Deferred / open:** whether the future **in-panel** AI analysis (Step 7b)
  adopts the same actionable stance or keeps a non-advice disclaimer in the UI
  is decided when 7b is built — this ADR governs the export path only.
- This amendment **relaxes** the PRD §2 non-goal ("Buy/Sell recommendations from
  the LLM") for the BYOK/export path; per the PRD's own rule, the ADR wins.

## Consequences

**Positive**
- The export is actually useful for the owner's pre-purchase decision-making.
- The requested JSON schema is strategy-shaped, so the planned re-ingestion /
  visualisation step has a concrete target.

**Negative**
- The extension now ships a prompt that solicits leveraged-trading suggestions.
  Acceptable because it is a personal BYOK tool, the output comes from the
  user's own chosen LLM, and the framing states it is not regulated advice.
- Two divergent stances may coexist temporarily: an actionable export vs. an
  as-yet-undecided in-panel stance. ADR for 7b will resolve this.

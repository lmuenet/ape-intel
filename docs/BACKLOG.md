# Backlog

Deferred work — recorded so decisions aren't lost. Not binding; pull an item
into a spec → plan → implementation cycle when it's picked up.

## Deferred from the planned build order

- **Step 7b — BYOK in-panel AI analysis.** Anthropic/OpenAI adapters + a stored
  API key + an in-panel "Analyse" button that calls the LLM directly and renders
  the structured response in the Side Panel (no copy-paste).
  - *Deferred 2026-05-30* by owner. The export + re-ingestion flow (Step 7a/7c)
    already covers the AI need: copy the briefing into any LLM, paste the answer
    back, see the strategy rendered. BYOK adds API-key handling, two provider
    adapters, cost, and an advice-stance ADR (does the in-panel path keep
    ADR-0002's non-advice disclaimer or follow ADR-0005's actionable stance?).
    Revisit when one-click in-panel analysis is worth that cost.

## Future ideas (not yet scoped)

- **Share a strategy with other users**, including which model produced it and
  when. The stored strategy already carries `ingestedAt`; the model name is not
  auto-detectable from a paste and would need user input. Sharing transport is
  unspecified.
- **Trending overview** (market-wide hottest plays + favourites). Explicit v1
  non-goal (CONTEXT.md / PRD §2); flagged in PRD §11 as the data foundation for
  the post-v1 external "Morning Call" routine.

## Small hardening / polish (nice-to-have)

- **Bare-JSON parse hardening** (`src/lib/strategy.ts`): the no-fence fallback
  only parses when the whole trimmed text is valid JSON, so bare JSON followed by
  trailing prose returns null. Realistic replies use the fenced ```json block
  (robustly handled), so this is low priority. A balanced-brace substring
  (`firstBrace..lastBrace`) would harden it.
- **"Ingested" timestamp shows UTC** (`StrategySection.tsx`): could render in the
  user's local timezone instead.

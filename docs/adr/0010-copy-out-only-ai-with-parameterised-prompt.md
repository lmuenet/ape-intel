# ADR-0010: v1 AI path is copy-out only with a parameterised prompt (supersedes ADR-0002's in-panel BYOK)

Status: Accepted
Date: 2026-05-31
Supersedes: ADR-0002 (in-panel BYOK call + Medium/Deep depth toggle only — the
Markdown-Briefing-as-context decision stands)

## Context

ADR-0002 accepted the extension's headline AI feature as an **in-panel BYOK
call**: thin Anthropic + OpenAI adapters, a stored API key, a Medium/Deep depth
toggle, and a structured response rendered in the Side Panel. That work (Step 7b)
was deferred and never built — the export + re-ingestion flow (Step 7a/7c) shipped
first and already covers the need: the user copies the **Briefing** (with the
**Export Prompt**) into any LLM, pastes the answer back, and sees the parsed
strategy rendered.

Revisiting Step 7b for the v1 finish line, the in-panel path keeps looking like a
bad trade. It re-introduces exactly the weight the rest of v1 stayed clear of:
two provider adapters, plaintext API-key handling and its disclosure UX, per-call
cost against the user's own key, and an unresolved advice-stance question
(ADR-0002's non-advice disclaimer vs. ADR-0005's deliberately actionable export
prompt). All of that buys one thing the copy-out flow lacks: not having to paste.

Meanwhile the copy-out flow has a cheaper lever the in-panel path does not: the
prompt is a plain editable artefact, so it can be **parameterised** by the user
without any provider, key, or cost. Looking at multi-agent trading frameworks
(e.g. TradingAgents) the transferable idea was never the agent orchestration — it
was the *reasoning structure*: an explicit bull-vs-bear debate and a stated risk
posture. Both fit a single external LLM via prompt wording alone.

## Decision

**v1 ships the AI path as copy-out only.** No in-panel model call, no stored
provider keys, no active-provider setting, no Medium/Deep depth toggle. The Side
Panel's "Copy briefing for AI" button and the paste-back **Strategy** flow are the
whole AI surface.

In exchange the export prompt gains two upgrades, both pure wording / local state:

- **Bull/Bear reasoning.** The default Export Prompt instructs the LLM to build the
  strongest bull case *and* bear case before concluding. Prose only — it feeds the
  existing strategy JSON fields, no schema change.
- **Trading Profile.** A per-export risk appetite (conservative / balanced /
  aggressive) and horizon (intraday / swing / position), set in the Side Panel and
  remembered between exports, injected into the prompt as a **preference, not a
  command**: the LLM must judge whether the profile fits the Asset before planning
  around it, and offer concrete levels only for a strategy it believes has an edge
  (otherwise "stay out", no invented levels).

ADR-0002's **substance stands**: the Markdown Briefing remains the model context,
and the non-advice framing is unchanged (the actionable stance is ADR-0005's, in
the export prompt, by deliberate choice). Only the *delivery mechanism* — an
in-panel keyed call with a depth toggle — is dropped from v1.

In-panel BYOK is **not deleted, indefinitely parked** (BACKLOG). If one-click
in-panel analysis ever becomes worth the key-handling, cost, and advice-stance
ADR, it returns as an *addition* to the copy-out path, not a replacement.

## Consequences

**Positive**
- v1 finishes without API-key storage UX, two provider adapters, per-call cost, or
  resolving the non-advice-vs-actionable advice-stance conflict.
- The AI path stays provider-agnostic: the user pastes into Claude, ChatGPT,
  Gemini, or a local model — whatever they already use.
- The Settings panel (F9) shrinks accordingly: no provider keys, no active
  provider, no AI-depth field. It carries the Finnhub key, log controls, and the
  editable base Export Prompt only.

**Negative**
- The user still has to copy and paste; there is no one-click answer in the panel.
  Judged acceptable — the paste step is one keystroke and buys provider freedom.
- Reverses an accepted (though unbuilt) ADR; a reader of ADR-0002 needs this note
  to understand why no in-panel call or depth toggle exists.

## Alternatives Considered

- **Build Step 7b as specified.** Rejected for v1: highest-cost remaining feature
  for a convenience the copy-out flow already approximates.
- **A quicklink that opens the user's LLM with the briefing pre-filled.** Rejected:
  web LLM `?q=` prefill is unreliable for multi-KB prompts and absent on local
  models; the clipboard + a bookmark already does the job.
- **A webhook so the LLM POSTs its answer back to the extension.** Rejected: far
  more moving parts than the paste-back flow it would replace.
- **Keep the Medium/Deep depth toggle without the in-panel call.** Rejected: depth
  only ever mattered for the keyed call's token budget; for copy-out the user (and
  the prompt) control depth directly.

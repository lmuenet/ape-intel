# ADR-0002: BYOK AI analysis with a Markdown briefing as model context

Status: Accepted
Date: 2026-05-28

## Context

The extension's headline AI feature is "ask an LLM to synthesise everything
we already collected for this Asset". Three sub-decisions had to land
together because they constrain each other:

- Which providers are supported.
- What shape the data takes when it reaches the model.
- How the user's API key is stored and disclosed.

A naive build would JSON.stringify the panel state and shove it into a
system prompt. That works once and rots fast: nobody can read a giant blob
to debug a bad answer, models get distracted by structural noise, and a new
field anywhere in the data pipeline silently changes prompt behaviour.

## Decision

**Providers.** Support Anthropic and OpenAI via a thin adapter. Both are
common, both have generous free credits for new users, and the adapter is
~50 LOC. No OpenRouter, no plugin model, no third provider in v1.

**Context shape.** Before any model call, the extension assembles a
**Briefing**: a Markdown document with fixed sections (Asset, Barometer,
Buzz, Trend, Earnings, News headlines, Top community posts). The Briefing
is what the model sees. It is also what we log for debugging and what we
could one day surface to the user as "here's exactly what the AI was told".

Granularity is **Medium** by default (headlines + first sentences + top
post titles). A "Deep dive" toggle expands to full article bodies and full
top posts.

**Output.** The prompt asks for a structured response in three blocks:
- *What the community is saying*
- *What the news is saying*
- *What to watch out for*

A non-advice disclaimer is rendered above the response, not inside the
prompt. The model is never asked to produce a Buy/Sell recommendation.

**Key storage.** `browser.storage.local`, plaintext. **No upfront warning
wall.** Disclosure happens lazily: when the user clicks "AI-Analyse" with
no key stored, they hit a small explainer with the storage caveat and a
"Save key" form. A "Delete key" button lives in the settings panel at all
times.

## Consequences

**Positive**

- Markdown Briefings are human-readable. A failing analysis can be opened
  and inspected like a document, not parsed out of a JSON dump.
- New data dimensions land in the Briefing as new sections — the change is
  visible at review time, not buried in a stringified object.
- Lazy key disclosure means a user who only wants the free panel never
  sees a security warning. The warning appears at the moment it's relevant.
- Two providers cover the majority of users who already pay an LLM bill.

**Negative**

- Markdown serialisation is one more transformation step to test.
- Plaintext key storage is a real risk for users with shared profiles. We
  accept that risk and surface it at the point of saving the key.
- No "pick your own provider" plug-in interface. Adding a third provider
  later is a code change, not a config change.

## Alternatives Considered

- **Pass raw JSON to the model.** Cheaper to implement, impossible to
  debug, and quality regressions are invisible.
- **Encrypted key storage gated by a session passphrase.** Sound from a
  security standpoint, brutal UX. Rejected for v1; revisit if users ask.
- **OpenRouter as the only provider.** One code path, but an additional
  signup, additional fees, and a single point of failure for the entire
  AI feature.

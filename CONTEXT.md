# Ape Intel — Context

Glossary of domain terms for this project. Implementation details belong elsewhere.

## Purpose

Firefox extension that augments a Scalable Capital asset page with community
sentiment + news, so a user can form a pre-purchase opinion on an
**Einzelaktie** without leaving the broker.

## Terms

### Asset
A tradable security viewed on Scalable Capital. Identified primarily by
**ISIN**. May or may not have a useful **US-Ticker** mapping.

### Einzelaktie (Single Stock)
Primary in-scope asset class. An Asset that represents a share in one company,
ideally with a US listing or US-ADR so that Reddit / StockTwits / Finnhub
have meaningful coverage.

### ETF
Out-of-primary-scope but tolerated. Receives a "best effort" panel: whatever
the news/price APIs return, nothing more. No sentiment expected.

### US-Ticker
The symbol used by external data sources (Reddit chatter, Finnhub, StockTwits).
Not the same as the XETRA ticker shown on Scalable. The bridge from
Scalable's ISIN to US-Ticker is the project's central plumbing problem.

### Coverage
Whether an Asset has enough external data to produce a useful panel.
Three states: **Covered** (US stock with chatter), **Thin** (mapped but quiet),
**Uncovered** (ETF / no US listing / no mapping). The UI must communicate
this state explicitly — empty panels are confusing, not neutral.

### Barometer
The single headline number for an Asset's community feeling. Computed as
a confidence-weighted mean across all available Sources (see ADR-0001).
Range: bearish ↔ bullish. Not the same as Buzz or Trend — those are
shown alongside, never folded in.

### Buzz
How loud the conversation is right now, independent of direction. Raw
aggregate mention volume across sources, bucketed for the UI.

### Trend
Direction of attention over the last 24h (mentions today vs. yesterday).
A momentum signal, not a sentiment signal.

### Source
A single upstream provider of community data: **Apewisdom**, **Tradestie**,
**StockTwits**. Each contributes a normalised sentiment + a volume; volume
becomes confidence in the Barometer formula. A Source returning no data for
an Asset is shown explicitly, never silently dropped.

### News Item
A single press article about an Asset. Headline + source + URL + publish
date. English only in v1. Top 5 of the last 7 days shown in the panel.

### Earnings Date
The next scheduled earnings report for an Asset, with consensus EPS
estimate when available. The only scheduled-event class in scope. Shown
visibly in the panel but not as the headline element. Past earnings,
dividends, splits, IPOs, insider trades: all out of scope.

### Badge
The always-visible UI element on a Scalable security page. Bottom-right
corner of the viewport, attached to `document.body`. Shows Barometer,
Buzz, Trend. Click opens the Side Panel. See ADR-0003.

### Side Panel
The on-demand drawer that holds the full panel content: News, Earnings
Date, per-Source breakdown, AI Analysis button. Width ~400px. Persists
its open/closed state across Asset switches within the SPA.

### Briefing
The Markdown document the extension assembles from collected data.
Two consumers, equal weight:
- **Internal**: payload for the BYOK AI Analysis call.
- **External**: exportable artefact — the user can copy it (with a
  predefined prompt prefix) into any LLM of their choice (Claude.ai,
  ChatGPT, Gemini). This makes the Briefing valuable independently of
  BYOK; users without an API key still get the extension's analysis
  output, just not the in-panel answer.
Fixed sections; depth toggleable between Medium and Deep dive. See
ADR-0002.

### Export Prompt
A short, predefined instruction block prepended to the Briefing on
copy/export, so the user pastes one self-contained message into an
external LLM. Editable in Settings. Default mirrors the structured
output format of the in-panel AI Analysis (community / news / watch-outs).

### AI Analysis
The structured response a supported LLM produces from a Briefing.
Three blocks: community, news, watch-outs. Never Buy/Sell. Triggered
by an explicit button, never automatic. Costs the user — runs against
their own API key.

### BYOK (Bring Your Own Key)
The user's API key for Anthropic or OpenAI, stored plaintext in
`browser.storage.local`. Disclosure of storage caveats happens at the
moment of saving, not in upfront onboarding.

### Favourite
An Asset the user has explicitly pinned via a star icon in the Side Panel.
Capped at 20 entries to protect free-tier API budgets. Only Favourites
are eligible for the Daily Snapshot job, and therefore only Favourites
ever have a 7-day momentum view. Opening an Asset in Scalable does not
make it a Favourite — pinning is an explicit user action.

### Daily Snapshot
A once-per-day background job that fetches Apewisdom sentiment + mentions
for each Favourite and appends them to a 7-day ring buffer in
`browser.storage.local`. Drives the 7-day momentum sparkline in the Side
Panel.

### Cache Refresh
The user-triggered "fetch now, ignore TTL" action on a Side Panel. Bound
to a per-Asset 3-minute cooldown to prevent API-limit burn.

## Explicit Non-Goals

- Portfolio monitoring or position tracking.
- ETF holdings analysis / sector aggregation.
- "Trending tickers across Reddit" discovery view. (Interesting follow-up,
  not MVP.)
- Trade execution or any write-action on Scalable.

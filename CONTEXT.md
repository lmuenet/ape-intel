# Ape Intel — Context

Glossary of domain terms for this project. Implementation details belong elsewhere.

## Purpose

Firefox extension that augments a supported **Broker**'s asset page with
community sentiment + news, so a user can form a pre-purchase opinion on an
**Einzelaktie** without leaving the broker. Scalable Capital was the first
supported Broker; the design generalises to further brokers (Smartbroker+, …)
via a Broker registry.

## Terms

### Broker
A trading platform whose security pages the extension augments. Each Broker is
defined by a URL match and a way to extract the **ISIN** from its security-page
URL — both held in a Broker registry, so adding a Broker is one registry entry
plus one manifest content-script match. Brokers expose the ISIN in the URL (no
DOM scraping): Scalable Capital as a query param
(`de.scalable.capital/broker/security?isin=…`), Smartbroker+ as the last path
segment (`app.smartbrokerplus.de/p/<portfolioId>/assets/<ISIN>`). A Broker that
hid the ISIN from its URL would need a different, broker-specific extractor and
is out of scope until one actually does.

### Asset
A tradable security viewed on a supported **Broker**. Identified primarily by
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

### Trending Board
A cross-Asset discovery view: the global "what is the community loudest about
right now" list, ranked by mention volume. Distinct from **Trend** — Trend is
*one* Asset's 24h momentum; the Trending Board ranks *many* Assets. It is
reachable two ways: as an in-page popover launched from the **Badge** (the
primary entry, visible on any Broker page) and from the browser toolbar (a global
fallback, reachable with no Broker page open). Both surfaces render the same
board. It has two parts: the market-wide trending list
(ranked by Apewisdom mentions) and a **Favourite** companion view showing each
Favourite's current standing plus its 7-day momentum sparkline. Its base ranking
is the Apewisdom snapshot the extension already caches. A row can expand to show
that Asset's full intel inline; it does not deep-link into a Broker, and a
trending row cannot be made a **Favourite** from here — favouriting needs the
**ISIN**, which the trending list (keyed only by **US-Ticker**) does not carry.
Both limits stem from the one-directional ISIN↔Ticker↔Broker-URL mapping. An
optional, explicitly
user-triggered AI **Challenge** pre-filters the trending list — it triages each
candidate as worth following, noise (a "dud" that does not deserve its trend),
or one to watch, so the user can narrow the field before committing. Like the
per-Asset strategy export it works by copy-out / paste-back (no automatic, keyed
call). It is the first stage of a funnel: Challenge narrows the trending list,
then the per-Asset strategy export does the deep dive on the chosen Asset. The
in-extension Trending Board is the manual sibling of the post-v1 external
"Morning Call" routine, not its replacement.

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
The always-visible UI element on a **Broker** security page. Bottom-right
corner of the viewport, attached to `document.body`. Shows Barometer,
Buzz, Trend. It is the extension's anchor and carries two actions: its main
area opens the **Side Panel** (this Asset); a separate icon opens the
**Trending Board** popover (market-wide). The two and the chart overlay are
mutually exclusive — opening one closes the others. See ADR-0003, ADR-0008.

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
- Trade execution or any write-action on a Broker.

Formerly non-goals, now planned (post-v1, audience still = author):

- **Further Brokers** beyond Scalable (Smartbroker+ first) via the Broker
  registry. Reversed because the author trades on more than one Broker. Stays
  cheap as long as every Broker exposes the ISIN in its URL.
- **Trending Board** — the cross-Asset discovery view. Now in scope as an
  in-extension, toolbar-opened view built on the already-cached Apewisdom
  snapshot.

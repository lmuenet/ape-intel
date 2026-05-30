# Ape Intel — Product Requirements Document (v1)

> Single product reference. Consolidates `CONTEXT.md`, the three accepted ADRs,
> and decisions captured during the planning session. **Binding decisions live
> in ADRs**; this document mirrors them for one-stop reading. If this doc and
> an ADR disagree, the ADR wins — and someone needs to fix this doc.

Status: Accepted for v1
Date: 2026-05-28

---

## 1. Product

**Ape Intel** is a Firefox MV3 WebExtension that injects a community-sentiment
and news panel into Scalable Capital security pages. The user is forming a
pre-purchase opinion on an Einzelaktie and does not want to leave the broker
to do it.

### Primary user
A single, technically-literate retail investor (the author) on Firefox. BYOK
audience: privacy-allergic.

### Value proposition
Three orthogonal signals (Barometer / Buzz / Trend) + Top 5 news of last 7
days + next earnings date + optional BYOK AI synthesis, all overlaid on the
broker page.

---

## 2. Scope

### In scope (MVP / v1)

- ISIN resolution from Scalable URL `?isin=…` query param
- OpenFIGI ISIN → US-Ticker mapping (permanent cache in `storage.local`)
- Hybrid UI: always-visible Badge (bottom-right of `document.body`) + on-demand
  Side Panel (~400px), auto-injected on security pages, persists across SPA nav
- Confidence-weighted three-source Barometer (Apewisdom + Tradestie + StockTwits)
  per **ADR-0001**, with Buzz and Trend shown alongside (never folded in)
- Per-source breakdown with explicit "no data" disclosure for empty sources
- Finnhub News (Top 5, last 7 days, English only) and Earnings Date (visible
  but not headline-prominent). Alpha Vantage is emergency fallback only;
  MarketAux dropped
- Coverage states: Covered / Thin / Uncovered, explicitly communicated in UI
- Manual Cache Refresh button with 3-minute per-Asset cooldown
- AI Analysis (BYOK) per **ADR-0002**: Anthropic + OpenAI adapters; Markdown
  Briefing assembled in extension as model context; structured output
  (community / news / watch-outs); never Buy/Sell; lazy key-storage disclosure
- Briefing export: copy Briefing + Export Prompt to clipboard for use in
  external LLMs without an API key
- Settings panel: API keys, provider choice, log level, logs view + copy
- Favourites (cap 20) with star toggle; Daily Snapshot background job that
  appends Apewisdom data to a 7-day ring buffer; 7-day momentum sparkline
  rendered only for Favourites
- Structured logger (DEBUG/INFO/WARN/ERROR), 500-entry ring buffer in
  `storage.local`, dev=all-levels, prod default=WARN+, user-toggleable
- Distribution: AMO Unlisted (Mozilla-signed, distributed via GitHub Releases)

### Out of scope for v1 (parking lot)

Trending-sector view, Q&A AI mode, German-language news, ETF sentiment via
holdings, own Reddit scraping fallback, StockTwits live stream, dividends /
splits / insiders, mobile/responsive polish, AMO Listed, custom date ranges,
multi-asset compare.

### Explicit non-goals

Portfolio tracking, trade execution, push notifications, own backend, other
brokers, telemetry of any kind. (The "no Buy/Sell recommendations from the LLM"
non-goal was relaxed for the BYOK **export** path by **ADR-0005** — the export
prompt now solicits an actionable trading strategy from the user's own LLM. The
in-panel stance is decided when Step 7b is built.)

> These non-goals bind **the extension**. A post-v1 *external* Claude Code
> routine that consumes the extension's exported data (see §11) does not violate
> them: the scheduling, synthesis and journaling live outside the extension, on
> the user's machine. "No backend / no push" stays true for the extension
> itself.

---

## 3. Domain glossary (reference)

Authoritative definitions live in `CONTEXT.md`. Terms used throughout this
document: **Asset**, **Einzelaktie**, **ETF**, **US-Ticker**, **Coverage**
(Covered / Thin / Uncovered), **Barometer**, **Buzz**, **Trend**, **Source**,
**News Item**, **Earnings Date**, **Badge**, **Side Panel**, **Briefing**,
**Export Prompt**, **AI Analysis**, **BYOK**, **Favourite**, **Daily
Snapshot**, **Cache Refresh**.

---

## 4. Architecture decisions (binding)

- **ADR-0001** — Multi-source confidence-weighted Barometer. Formula:
  `barometer = Σ(sentiment_i × confidence_i) / Σ(confidence_i)`, with
  `confidence_i = min(1, volume_i / threshold_i)`. Per-source thresholds are
  calibration knobs; defaults from ADR, **revisit with real-world data**.
  Buzz and Trend are separate signals.
- **ADR-0002** — BYOK AI Analysis with Markdown Briefing. Anthropic + OpenAI
  via thin adapter. Briefing = fixed-section Markdown doc, Medium default /
  Deep dive toggle. Structured output (community / news / watch-outs). Key
  stored plaintext in `storage.local` with lazy disclosure at save time.
  Briefing has a second consumer: **Export** for use in external LLMs.
- **ADR-0003** — Hybrid Badge + Side Panel, both attached to `document.body`,
  not into Scalable's React tree. Auto-injection on security URLs.
  `MutationObserver` + URL listener on `?isin=` drive SPA-nav handling.

If any of these need to change, write a new ADR that supersedes the previous
one — don't silently drift.

---

## 5. Data sources

| Source       | Purpose                         | Auth         | Notes                                  |
|--------------|---------------------------------|--------------|----------------------------------------|
| OpenFIGI     | ISIN → US-Ticker                | None (MVP)   | Permanent cache in `storage.local`     |
| Apewisdom    | Sentiment + mentions + 24h trend| None         | Multi-subreddit aggregate              |
| Tradestie    | r/WSB sentiment + comment count | None         | Often empty for non-meme tickers       |
| StockTwits   | Bull/Bear messages              | None         | Self-tagged → bullish bias             |
| Finnhub      | `/company-news`, `/calendar/earnings` | API key | Primary news + earnings                |
| Alpha Vantage| News fallback                   | API key      | Emergency only                         |
| Anthropic    | AI Analysis                     | BYOK         | Per ADR-0002                           |
| OpenAI       | AI Analysis                     | BYOK         | Per ADR-0002                           |

### Identifier pipeline

Scalable URL pattern (verified):
`https://de.scalable.capital/broker/security?isin=US0378331005&portfolioId=…`

Pipeline: URL `?isin=…` → OpenFIGI → US-Ticker → cache permanently → fan out to
sentiment/news adapters.

### TTLs and refresh

| Data             | TTL    | Notes                              |
|------------------|--------|------------------------------------|
| Sentiment        | 15 min |                                    |
| News             | 30 min |                                    |
| Earnings         | 24 h   |                                    |
| ISIN → Ticker    | ∞      | Permanent cache                    |
| Manual Refresh   | —      | 3-minute per-Asset cooldown        |

---

## 6. Functional requirements

### F1. Detection & injection
On any `https://de.scalable.capital/broker/security?isin=…` URL, the extension
auto-injects the Badge into `document.body`. On SPA navigation that changes
the `isin` query param, the Badge re-renders with the new Asset's data and
the Side Panel (if open) re-renders without collapsing.

### F2. Coverage classification
For each Asset:
- **Covered**: US listing with chatter in ≥1 sentiment source
- **Thin**: mapped to a US-Ticker but all sources are quiet/empty
- **Uncovered**: ETF, no US listing, or no OpenFIGI mapping

The state is shown explicitly. Empty panels are never silent.

### F3. Barometer / Buzz / Trend
Computed per ADR-0001. Headline numbers shown on the Badge. Per-source
breakdown (sentiment, volume, confidence, "no data" marker) visible in the
Side Panel.

### F4. News & Earnings
Top 5 News Items from last 7 days (Finnhub `/company-news`, English only).
Next Earnings Date with consensus EPS estimate when Finnhub returns one;
visible in Side Panel but not as headline element.

> **Post-v1 direction (§11):** the News section is expected to grow from a
> Top-5 display toward *catalyst-grade*, structured output (earnings, guidance,
> M&A, regulatory, etc.) that an external routine can reason over. Keep News
> Items in a structured, exportable shape so this is additive later, not a
> rewrite.

### F5. Manual refresh
A Refresh button in the Side Panel ignores TTLs for the current Asset.
Disabled for 3 minutes after each use (per Asset).

### F6. Favourites & Daily Snapshot
Star toggle in Side Panel pins an Asset (≤20). Implicit "watched" is rejected
— pinning is explicit. A daily background job iterates Favourites, fetches
Apewisdom data, and appends to a per-Asset 7-day ring buffer in
`storage.local`. Side Panel renders a 7-day momentum sparkline **only** for
Favourites.

### F7. AI Analysis (BYOK)
Per ADR-0002. Button in Side Panel. If no key stored, shows lazy explainer +
"Save key" form (with storage caveat). On submit, assemble Briefing (Medium
default; Deep dive toggle), call selected provider, render structured output
(community / news / watch-outs) with non-advice disclaimer above the
response. Never Buy/Sell.

### F8. Briefing export
Copy-to-clipboard action emits `<Export Prompt>\n\n<Briefing Markdown>`.
Export Prompt default mirrors the structured-output format; editable in
Settings.

### F9. Settings
- API keys (Anthropic, OpenAI): save / delete
- Active provider
- AI depth: Medium / Deep dive
- Log level
- Logs view (last 500 entries) with copy-to-clipboard
- Export Prompt editor

### F10. Logging
Structured logger with levels DEBUG / INFO / WARN / ERROR. 500-entry ring
buffer in `storage.local`. Dev build = all levels emitted; production default
= WARN+; user-toggleable in Settings.

### F11. No telemetry
Zero outbound calls to anything other than the data sources listed in §5 and
the user's chosen LLM provider.

---

## 7. Non-functional requirements

- **Privacy**: no telemetry, no analytics, no error reporting service. API keys
  stored locally only.
- **Performance**: Badge rendered within ~300ms of ISIN detection (cache hit)
  or within ~1.5s (cold OpenFIGI + first-source fetch). Side Panel open is
  instant; data fills progressively.
- **Resilience**: any one source failing degrades the Barometer (lower total
  confidence, still rendered). Two-of-three down should render Barometer as
  "low confidence" but still show. Three-of-three down → "Sentiment
  unavailable", not a crash.
- **Storage budget**: `storage.local` use bounded by ISIN→ticker cache + ≤20
  Favourites × 7 daily snapshots + 500-entry log ring buffer + settings. No
  unbounded growth.

---

## 8. Tech stack

- TypeScript
- Vite + `@crxjs/vite-plugin`
- Preact
- Vitest (unit tests; primary targets: aggregation formula and Source adapters)
- Firefox MV3 WebExtension APIs
- No E2E in v1
- Dev workflow: `about:debugging` → Temporary Add-on
- Distribution: AMO Unlisted, GitHub Releases

---

## 9. Build order

Each step leaves a runnable demo. Each step gets its own implementation plan
in `docs/superpowers/plans/`.

1. **Skeleton** — extension loads on Scalable, ISIN detected, Badge prints it
2. **ISIN → Ticker pipeline** — OpenFIGI adapter + permanent cache
3. **Apewisdom adapter** — raw sentiment in Side Panel
4. **Tradestie + StockTwits adapters + aggregation** — full Barometer
5. **Finnhub News + Earnings**
6. **Favourites + Daily Snapshot + 7-day sparkline**
7. **AI Analysis** — Briefing assembly + Anthropic/OpenAI adapters + export
8. **Polish** — Settings, Logging UI, Coverage states copy, error states

> **Forward pressure from the post-v1 vision (§11):** the Trending overview and
> Tradestie reactivation are no longer just "nice to have" — they are the data
> foundation for the future Morning Call's market-wide scan. Likewise the News
> section is expected to grow toward *catalyst-grade*, structured output (see
> §6 F4 note). These remain post-MVP, but the v1 work should avoid choices that
> make them hard to add later (e.g. keep news items and the daily snapshot in a
> structured, exportable shape).

---

## 10. Open calibration items

- Per-source confidence thresholds in ADR-0001 use the ADR defaults; revisit
  once we have real usage data. Implementation must keep thresholds
  parameterised, not hard-coded constants scattered across modules.
- Optional: a manual hide toggle for the Badge if it collides with Scalable
  tooltips/modals in practice (ADR-0003 anticipates this).

---

## 11. Future direction (post-v1): Daily Trading Loop

> Vision, **not** binding for v1. Full design: `docs/superpowers/specs/2026-05-29-daily-trading-loop-design.md`.

Once the MVP is complete, the plan is to build — *externally* — a pair of
scheduled **Claude Code routines** (cron) that turn the extension's collected
data into a daily trading workflow. The extension stays the data
collector/frontend; the routines are the analyst on top.

- **Morning Call** (pre-open): a market-wide scan for the day's hottest plays
  plus a focused watch list, driven by trending sentiment (Apewisdom +
  Tradestie + StockTwits), catalyst-grade news, and today's earnings.
- **Evening Review** (post-close): asks which plays were made, logs them to a
  Trade Journal, and analyses them in retrospect to refine strategy over time.

The routine consumes the extension's **own sources** in a structured way inside
the cron (ideally via an exported daily snapshot / the existing Markdown
Briefing), rather than re-scraping upstream APIs. This is why §9 flags the
Trending overview, Tradestie reactivation, catalyst-grade News and a structured
export as forward pressure on the v1 build.

# ADR-0004: Apewisdom has no public sentiment; Tradestie is a different host

Status: Accepted
Date: 2026-05-28
Supersedes parts of: ADR-0001

## Context

After wiring up Apewisdom and Tradestie in Step 4 and observing real responses
in Firefox, two assumptions baked into ADR-0001 turned out to be wrong:

1. **Apewisdom's free public API does not expose any sentiment field.** The
   live response contains only `rank`, `ticker`, `name`, `mentions`, `upvotes`,
   `rank_24h_ago`, `mentions_24h_ago`. No `sentiment_score`, no `bullish_pct`,
   no sentiment text. ADR-0001 listed Apewisdom as providing
   "mentions + bullish-% + 24h-trend"; the bullish-% half is not available
   without scraping the apewisdom.io HTML, which we ruled out for the same
   reasons we rejected building our own Reddit scraper.

2. **Tradestie's reddit endpoint lives on `api.tradestie.com`, not
   `tradestie.com`.** The URL we shipped (`https://tradestie.com/api/v1/...`)
   returns 404. The correct endpoint, per their public docs, is
   `https://api.tradestie.com/v1/apps/reddit`. The response shape we assumed
   (`no_of_comments`, `sentiment`, `sentiment_score`, `ticker`) is correct;
   only the host + path was wrong. Free anonymous rate limit: 20 req/min.
   Free tier is also documented as "top 5 results per endpoint" for
   authenticated endpoints — the reddit endpoint does not appear to be
   capped this aggressively in practice (the example payload shows GME, AMC,
   PLTR…), but expect at most ~50 tickers ever, since the endpoint covers
   only r/wallstreetbets and only the day's top discussion.

## Decision

### Apewisdom — buzz/trend only, no sentiment

The `ApewisdomEntry` type drops `sentimentScore`. The Apewisdom section in
the Side Panel drops its Sentiment column and instead shows mentions + rank +
24h-trend arrow as the three primary signals.

In the future Barometer formula (Step 4.5), **Apewisdom does not contribute
a sentiment term**. It contributes only to:

- **Buzz** — Apewisdom's `mentions` (across many subreddits) is the most
  representative volume signal we have.
- **Trend** — Apewisdom's `mentions` vs `mentions_24h_ago` drives the
  ↑/→/↓ arrow.

The Barometer is therefore built from two sentiment sources (StockTwits +
Tradestie), not three. ADR-0001's confidence-weighted-mean formula still
applies, just with N=2 sources instead of N=3 in the sentiment sum. The
formula's main resilience claim ("any one source going down degrades the
barometer") becomes "any one source going down halves our sentiment
confidence" — uncomfortable but honest.

### Tradestie — corrected URL and host_permission

- Endpoint: `https://api.tradestie.com/v1/apps/reddit` (optionally with
  `?date=MM-DD-YYYY`; omit for latest).
- Manifest host_permission: `https://api.tradestie.com/*` (was
  `https://tradestie.com/*`).
- Response shape unchanged: `[{ no_of_comments, sentiment, sentiment_score,
  ticker }, …]`.

### Implications for the Side Panel

- **StockTwits** stays the prominent sentiment source at the top of the
  panel. Reinforced now that Apewisdom is sentiment-blind.
- **Tradestie** stays in its own section with comments + sentimentLabel +
  sentimentScore (we already collect these but only render the label
  currently — Step 4.5 will surface the score).
- **Apewisdom** becomes the "how loud + which way moving" section,
  visually demoted to a stat triplet without a sentiment cell.

## Consequences

**Positive**

- We stop rendering an empty `/ 100` slot in the UI, which is a clear user
  bug right now.
- The Barometer formula gets simpler (2 sources) and more honest about its
  data dependencies.
- Apewisdom keeps its place in the design as the canonical Buzz/Trend
  signal — its real strength, given it covers ~9 subreddits to Tradestie's 1.

**Negative**

- We have only **two** sentiment sources, both with structural biases:
  StockTwits's self-tagged bullish skew and Tradestie's WSB-only narrowness.
  Many real-world tickers will have neither, leaving the Barometer
  undefined.
- If StockTwits ever rate-limits us, the Barometer becomes single-source on
  Tradestie alone for any non-WSB ticker.
- A future bullish-% scrape of apewisdom.io HTML is now tempting but stays
  out of scope per the original "no scraping" stance.

## Alternatives Considered

- **Apewisdom paid tier.** Their site doesn't advertise one publicly; not
  pursued.
- **Scrape apewisdom.io HTML for sentiment.** Rejected for the same reasons
  as the original Reddit-scraping rejection in ADR-0001 (fragile, ToS-gray).
- **Drop Apewisdom entirely.** Loses the broadest Buzz signal we have. The
  Buzz/Trend contribution is genuinely valuable independent of sentiment.
- **Add a fourth sentiment source.** No obvious free candidate. Revisit in a
  later ADR if StockTwits + Tradestie prove too thin in practice.

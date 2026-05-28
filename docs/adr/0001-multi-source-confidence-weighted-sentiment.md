# ADR-0001: Multi-source confidence-weighted sentiment barometer

Status: Accepted
Date: 2026-05-28

## Context

The product needs to show a single, intuitive "community feeling" indicator
for an Einzelaktie. Three external sources are within reach for the MVP, each
free-tier:

- **Apewisdom** — aggregates ~9 investing subreddits, returns mentions +
  bullish-% + 24h-trend per ticker.
- **Tradestie** — r/wallstreetbets only, returns comment count + extracted
  sentiment score.
- **StockTwits** — non-Reddit trader community, returns self-tagged
  Bullish/Bearish messages.

Each speaks a different scale. Each has different volume characteristics
(Apewisdom counts across many subs; Tradestie is WSB-only and often empty for
non-meme stocks; StockTwits has a structural bullish bias because
self-tagging skews optimistic). A naive mean would let Apewisdom dominate
and let three self-declared bulls on StockTwits flip the verdict of a
seriously-discussed stock.

We also can't realistically build our own Reddit scraping + NLP for the MVP:
Reddit's JSON endpoints are increasingly unreliable, CORS blocks the
extension from calling them directly, and running FinBERT/VADER inside a
content script is impractical.

## Decision

Aggregate the three sources into **one barometer** using a
**volume-as-confidence weighted mean**:

```
for each source i:
  sentiment_i ∈ [-1, +1]    (normalised from source's native scale)
  volume_i    = mentions / messages / comments returned
  confidence_i = min(1, volume_i / threshold_i)
                 (threshold_i is per-source, calibrated empirically)

barometer = Σ(sentiment_i × confidence_i) / Σ(confidence_i)
```

Two further metrics ride alongside the barometer, **not folded into it**:

- **Buzz** — raw aggregate mention volume, bucketed (quiet / chatter / loud /
  on-fire).
- **Trend** — today's mentions vs. yesterday's (↑ / → / ↓), sourced from
  Apewisdom's built-in 24h-ago field.

UI: one prominent barometer reading. Per-source breakdown on hover/expand.
Empty sources are shown explicitly as "no data" rather than silently dropped.

## Consequences

**Positive**

- Each source's influence scales with how much it actually saw. A
  three-message StockTwits ticker cannot outvote a 500-mention Apewisdom
  ticker.
- New sources can join later without re-tuning the formula — they just bring
  their own threshold.
- Separating Buzz and Trend from Sentiment gives the user three orthogonal
  signals ("how loud, which way moving, what feeling") instead of one
  conflated number.

**Negative**

- Thresholds per source are a calibration knob we have to set with
  judgement, not derivation. They'll need revisiting once we have real usage
  data.
- A user-tunable weighting in the options panel is **explicitly rejected for
  MVP** — too many knobs, no good defaults to start from. Reopen if users ask.
- We depend on three third parties. Any one going down degrades the
  barometer (confidence drops, others compensate); two down makes it
  unreliable. Acceptable for v1, revisit if Apewisdom in particular becomes
  flaky.

## Alternatives Considered

- **Single source (Apewisdom only).** Simpler, but a single point of failure
  and no redundancy when Apewisdom misses a ticker.
- **Fixed weights (e.g. 50/30/20).** Easier to explain but punishes stocks
  where one source happens to be quiet, and rewards Stocktwits' bullish bias
  whenever volume is low.
- **Own Reddit scraping + on-device NLP.** Multi-week build, fragile
  infrastructure, no clear quality win over Apewisdom which already does
  exactly this.

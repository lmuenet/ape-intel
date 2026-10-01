# Ape Intel — Morning Stock Trends Report
**2026-10-01 · pre-market (generated 06:47 UTC / 08:47 CET)**

> ⚠️ **Data-source note.** This environment's network egress policy **blocks the extension's own
> APIs** (`apewisdom.io`, `api.tradestie.com`, `api.stocktwits.com`) *and* `reddit.com` directly.
> Figures below are reconstructed from **web-search snippets** of aggregators that mirror the same
> Apewisdom Reddit-mention methodology the extension uses. Treat mention counts as **approximate**
> and freshness as **mixed** (some snippets are tagged late-Sep). Confidence/Buzz/Trend labels apply
> the extension's own `barometer.ts` thresholds. **Not financial advice — informational research only.**

---

## 1. Trending stocks (extension-style board: ranked by community mentions)

Buzz buckets (extension defaults): Quiet <25 · Chatter 25–99 · **Loud 100–499** · On-fire ≥500.
Trend = mentions vs 24h ago. Confidence is low when fewer than 2 sentiment sources agree.

| # | Ticker | Price / move (Oct 1) | Mentions (~24h) | Buzz | Trend | Sentiment | Confidence | AI Challenge |
|---|--------|----------------------|-----------------|------|-------|-----------|-----------|--------------|
| 1 | **MU** (Micron) | ~flat* | ~259, **+103%** | Loud | ↑ | Bullish | **Med–High** (price + chatter align) | *Is the AI-memory/HBM re-rating already priced, or is this the start?* |
| 2 | **META** | — | ~170 | Loud | → | Neutral | **Low** (high volume, no directional conviction) | *Spot the noise: loud but neutral — what's actually driving mentions?* |
| 3 | **UBER** | $68.83 (+1.8%) | ~156, **+3800%** | Loud | ↑↑ | Neutral | **Low** (spike without a sentiment lean = event-driven) | *A 38× mention spike with neutral sentiment — catalyst or crowd noise?* |
| 4 | **NVDA** | ~$229 (+0.5%) | ~150 | Loud | ↑ | Bullish | **Med** (steady, well-covered) | *Is NVDA momentum sustainable at this level, or just index gravity?* |
| 5 | **GOOG** | — | ~148 | Loud | ↑ | Bullish | **Med** | *Strong "AI score" — is the thesis fresh or a recycled consensus long?* |
| 6 | **SPCX** (SpaceX?) | n/a | ~143 | Loud | ? | — | **Very Low** (not a listed equity — likely mis-tag) | *Spot the noise: can you even trade this? Probable ticker-noise.* |
| 7 | **TSLA** | — | ~134 | Loud | → | Mixed | **Low** | *Perennial top-mention — signal, or just WSB background radiation?* |
| 8 | **AMZN** | — | ~108 | Loud | → | Bullish | **Med** (voted WSB "top 2026" name) | *Consensus favourite — where's the edge if everyone's already long?* |
| 9 | **HOOD** | $112.50 (−3.2%) | surging **+108%** | Loud | ↑ | Bullish | **Med** (mentions up as price dips = dip-buy crowd) | *Mentions up while price falls — conviction dip-buy or bag-holding?* |
| 10 | **NFLX** | — | ~74 | Chatter | → | Neutral | **Low** | *Sub-loud volume — is this worth the extension's "watch" bucket at all?* |

\* *MU price snippet returned an anomalous ~$1,065 figure (likely a tokenized/mis-scaled quote); treat the level as unverified and the move as roughly flat on the day.*

**Signal vs. noise read (extension "AI Challenge" triage):**
- **Signal:** MU, NVDA, GOOG — chatter *and* price/fundamentals point the same way, multi-day trend.
- **Watch:** UBER (huge event-driven spike, no sentiment lean — wait for the catalyst to resolve), HOOD (dip-buy divergence), AMZN.
- **Noise:** META (loud but directionless), SPCX (un-tradeable/mis-tag), TSLA (chronic high-mention baseline).

---

## 2. Reddit crawl — discussion momentum & sentiment

Targeted: r/wallstreetbets, r/shortsqueeze, r/wallstreetbetsGer. *(Live subreddit JSON blocked by egress;
below is from search-indexed snapshots.)*

**r/wallstreetbets — gaining momentum**
- **MU** — ~259 mentions, **bullish**, +103% 24h. Highest-conviction name on the board.
- **UBER** — +3800% mention spike, **neutral** tone → classic event/headline burst, low conviction.
- **HOOD** — +108% mentions, **bullish** despite the −3.2% tape → dip-buying conviction.
- **NVDA / GOOG / AMZN** — steady bullish big-tech "barbell" longs (WSB's stability + high-beta pairing).

**r/shortsqueeze — high short-interest / squeeze setups**
- **IMRX** — ~94% of float short, ~27 days-to-cover (strongest raw setup).
- **TTAN** ~82%, **GRPN** ~78%, **AEMD** ~66% float short.
- Screener names cited: RIOT, PYPL, AKAM, DKNG, Largo (high short ratio, lower conviction).
- **GME** — ~360 mentions and rising; the perennial squeeze/meme anchor. Conviction high-emotion, low-edge.
- Also seen on mention lists: **CRSR** (~310), **SPCE** (~255).

**r/wallstreetbetsGer** — *no specific German-sub data surfaced through the allowed sources today.*
Flagged as a **coverage gap**, not an "all quiet."

---

## 3. Consolidated watchlist (cross-source)

🔴 = appears in **both** the extension-style trend board **and** Reddit discussion (strongest attention overlap).

| Ticker | In trend board | In Reddit crawl | Net read | Confidence |
|--------|:-:|:-:|----------|-----------|
| 🔴 **MU** | ✓ (#1) | ✓ WSB bullish | **Top signal** — momentum + fundamentals align | Med–High |
| 🔴 **NVDA** | ✓ (#4) | ✓ WSB bullish | Steady signal, well-covered | Med |
| 🔴 **GOOG** | ✓ (#5) | ✓ WSB bullish | Signal, watch for thesis freshness | Med |
| 🔴 **UBER** | ✓ (#3) | ✓ WSB (spike) | **Watch** — event spike, resolve catalyst first | Low |
| 🔴 **HOOD** | ✓ (#9) | ✓ WSB bullish | **Watch** — price/mention divergence | Med |
| 🔴 **TSLA** | ✓ (#7) | ✓ WSB | Noise-leaning baseline | Low |
| 🔴 **GME** | — | ✓ shortsqueeze | Meme/squeeze, high emotion / low edge | Low |
| **IMRX** | — | ✓ shortsqueeze | Pure squeeze mechanics (94% float short) | Spec |
| **AMZN** | ✓ (#8) | ✓ WSB | Consensus long, limited edge | Med |

**One-line take:** The real **signal** cluster is the AI-semis/big-tech complex (**MU, NVDA, GOOG**);
the loudest **noise** is event-spike (**UBER**) and perennial meme baseline (**TSLA, GME**); the most
interesting **watch** divergence is **HOOD** (mentions ↑ while price ↓). Squeeze board (**IMRX/TTAN/GRPN**)
is mechanically interesting but speculative.

---

### Sources (web-search snippets; extension APIs blocked)
AltIndex (WSB / Reddit most-mentioned), Adanos (Reddit top-100), Tradestie (WSB active), AltIndex short-squeeze,
TheDesperateTrader, Google/CNBC/TradingView quotes. Mention counts approximate; verify against the live
extension board (Apewisdom) once an un-restricted network is available.

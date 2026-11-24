# Ape Intel — Morning Stock Trends Report
**2026-11-24 · Pre-market (US open 15:30 CET)**

> ⚠️ **Data-source note.** This session's network policy **blocks the extension's live
> API hosts** (`apewisdom.io`, `tradestie.com`, `stocktwits`, `reddit.com` all fail DNS).
> I could not hit the Apewisdom Trending Board feed the extension actually uses, nor crawl
> Reddit directly. Everything below is reconstructed via **web search** of those same pages,
> so figures are **approximate and freshness is unverified** (several snapshots carried no
> timestamp or were stamped Nov 23). To get true live data on future runs, allow
> `apewisdom.io`, `tradestie.com`, `stocktwits.com` and `reddit.com` in the session's
> network settings. Treat this as directional, not a trading signal.

---

## 0. Market backdrop (the real driver today)
A broad **chip / AI / "neocloud" rebound** is running in pre-market after last week's
sharp AI selloff. Aggregator snapshots show outsized bounces — **NVDA, MU, AMD, PLTR,
GOOGL all green** — following NVIDIA leadership turmoil and a ~40% NVDA drawdown over the
past month. The quoted % moves (below) look implausibly large for mega-caps and almost
certainly reflect stale/mis-scaled aggregator data — **do not trade off these numbers.**
The takeaway that *is* reliable: today's social buzz is a **dip-buy / rebound narrative**
concentrated in semis and AI names.

---

## 1. Extension Trending Board (Apewisdom-ranked)

The Trending Board ranks by Apewisdom mentions. Two Apewisdom views disagree (as they
normally do): the **all-subreddits** feed (`/all`) captures fresh spikes; the
**r/wallstreetbets** feed captures raw volume.

| Ticker | Name | Approx. price / move* | Mentions (source) | 24h trend | Signal quality | Confidence | AI Challenge |
|---|---|---|---|---|---|---|---|
| **NVDA** | NVIDIA | ~$165, bouncing hard off a –40% month | 553 (WSB) / 52 (all) / 1,468 (AltIndex) | WSB **–57%**, all **+108%** | High buzz, **mixed momentum** — volume cooling on WSB even as it leads | **Med-High** (it's genuinely the market's center) | *Spot the noise:* it's the most-watched stock on earth — is "trending" telling you anything, or just that it exists? |
| **PLTR** | Palantir | ~$157 (+9% aggregator) | 139 (all) / 124 (Quiver) | all **+672%** 🔥 | **Fresh, sharp spike** — real new attention | **High** that it's spiking; **Med** on direction | *Is this momentum sustainable?* A +672% mention spike with no named catalyst usually mean-reverts within 48h. |
| **AAPL** | Apple | ~flat | 236 (all) / 241 (AltIndex) | all **+424%** 🔥 | Fresh spike + cross-source agreement | **High** | *Spot the noise:* mega-cap + holiday-week chatter. Is this a catalyst or just index-rebound spillover? |
| **MU** | Micron | ~$690 (+16% aggregator) | top-10 (WSB) | rising | Riding the semis rally | **Med** | *Is this momentum sustainable?* Memory pricing cycle, or just beta to the NVDA bounce? |
| **AMD** | AMD | ~$477 (+12% aggregator) | 73 (WSB) | WSB **–73%** | Volume **falling** despite price pop | **Low-Med** | *Spot the noise:* price up but mentions down — attention isn't confirming the move. |
| **GOOG/GOOGL** | Alphabet | ~$284 (+7% aggregator) | 152 (AltIndex) | rising | Broad-tech rebound beneficiary | **Med** | *Is this a trend or a tide?* Separate Alphabet-specific news from "everything AI is green today." |
| **SPY / QQQ** | Index ETFs | — | SPY 254 (WSB) / 417 (Quiver); QQQ 98 | mixed | **Macro hedging chatter, not single-stock signal** | n/a | *Out of scope:* the extension is for Einzelaktien — treat index ETFs as noise here. |

\* Prices are unverified aggregator snapshots; see the backdrop note. **Do not size trades off them.**

---

## 2. Reddit-sourced discussion (via search of WSB / shortsqueeze / Ger)

Direct Reddit crawling was **blocked** (reddit.com DNS refused), so this is search-derived
and thinner than usual.

- **r/wallstreetbets** — dominated by the **AI/semis dip-buy** thread: NVDA, PLTR, SPY,
  AMD, MU. Quiver's WSB tracker (undated) also surfaced **HIMS (139), CELH (126),
  RDDT (101), SMCI (95), V (279)**. Sentiment: **cautiously bullish / "buy the dip"**
  conviction, moderate — a rebound-chasing crowd, not a high-conviction squeeze mob.
- **r/shortsqueeze** — **no current squeeze candidate surfaced.** Search returned only
  stale 2021–2023 material. Either quiet, or (more likely) just not indexed. Flagging as
  **unconfirmed, not "nothing happening."**
- **r/wallstreetbetsGER** — **no current German-specific trend found.** German retail
  chatter (wallstreet-online hot-stocks) was not retrievable live. Nothing to report;
  needs the Reddit domain unblocked to assess.
- **StockTwits trending** (undated cache) — **BONK, IOVA, DJT, AAPL, CELH.** BONK is
  crypto and DJT (Trump Media) is a politics-driven mover — both **outside the extension's
  single-US-equity sweet spot.** IOVA (Iovance) is a genuine small-cap biotech worth a look.

Conviction read overall: **medium and rebound-driven**, not the kind of concentrated,
high-conviction single-name mania the squeeze subs produce.

---

## 3. Consolidated watchlist

Ranked by how many independent sources flag the name (cross-source agreement = less noise):

| Rank | Ticker | In extension trend? | In Reddit chatter? | Why it's on the list | Watch confidence |
|---|---|---|---|---|---|
| 1 | **NVDA** | ✅ (all sources) | ✅ | The axis of today's rebound; everything semis keys off it | **High** |
| 2 | **PLTR** | ✅ | ✅ (Quiver + all) | Sharpest fresh mention spike (+672%); needs a catalyst check | **High (as a watch)** |
| 3 | **AAPL** | ✅ | ✅ (StockTwits + AltIndex) | +424% spike, broad agreement | **Med-High** |
| 4 | **MU** | ✅ | ✅ (WSB top-10) | Clean semis-rally play | **Med** |
| 5 | **AMD** | ✅ | ✅ | Price up but **mentions falling** — watch for divergence | **Low-Med** |
| 6 | **HIMS** | ❌ | ✅ (Quiver 139) | Recurring retail favorite, independent of the AI trade | **Med** |
| 7 | **CELH** | ❌ | ✅ (Quiver + StockTwits) | Appears on two Reddit/social trackers | **Med** |
| 8 | **IOVA** | ❌ | ✅ (StockTwits) | Small-cap biotech; real single-name, worth a glance | **Speculative** |

**Flagged in BOTH extension trend and Reddit discussion:** **NVDA, PLTR, AAPL, MU, AMD**
(the AI/semis cluster). That overlap is the day's strongest consensus — and also its
biggest crowding risk.

**Noise to discount:** SPY/QQQ (macro, not single stocks), BONK (crypto), DJT (politics).

---

### Bottom line
One story today: a **semis/AI rebound** after last week's selloff, with NVDA at the center
and PLTR showing the hottest fresh retail attention. The squeeze and German subs were quiet
or unreachable. **Biggest caveat:** the live data pipes the extension depends on are blocked
in this environment, so confidence scores reflect cross-source *agreement*, not verified
real-time feeds. Unblock the four domains above to turn this from "directional" into the
real Trending Board.

# 🦍 Ape Intel — Morning Stock Trends Report

**Run:** 2026-10-13, pre-open (CET morning edition) · US cash open 15:30 CET / 09:30 ET
**Author:** Ape Intel scheduled routine

> ⚠️ **Data-source note (important).** The Ape Intel extension's own backing
> APIs — `apewisdom.io` (Trending Board) and `api.tradestie.com` (Reddit/WSB
> sentiment) — are **blocked by this environment's egress policy** and were
> unreachable this run (DNS denied). Direct site fetches (`altindex.com`,
> `tradestie.com`, `adanos.org`) are blocked too. The trend data below is
> therefore **reconstructed via web search over public mirrors of the same
> Reddit-mention methodology** the extension fuses (Apewisdom = mentions/rank;
> Tradestie = WSB sentiment). Figures are the **latest available (~12–24h old)**,
> not a live pre-open snapshot. Live prices could not be confirmed for today —
> **verify every price/level at your broker before acting.** Not investment advice.

---

## 1. Trending stocks (extension-equivalent board)

Ranked by Reddit mention volume (Apewisdom-style), with the extension's
signal / noise / watch triage and a confidence score (0–5, my read of how
much the trend is *signal* vs. *crowd noise*).

| # | Ticker | Name | Recent move* | Sentiment | Mentions (24h) | Triage | Conf. | AI Challenge |
|---|--------|------|--------------|-----------|----------------|--------|-------|--------------|
| 1 | **NVDA** | NVIDIA | ~$226 (−1.3% Oct 12 close) | Bullish | ~110–270, steady | ⚪ Watch | 2/5 | *Spot the noise:* NVDA tops every board every day. Is this a real catalyst or just permanent mega-cap background chatter? |
| 2 | **MU** | Micron | +4.7% | Neutral | ~200, high | 🟢 Signal | 3/5 | *Is this momentum sustainable?* Memory/HBM supply cycle — is the move pricing a real earnings re-rate or chasing the AI-memory narrative? |
| 3 | **SNDK** | SanDisk | +6.6% | Bullish | ~90–150, rising | 🟢 Signal | 3/5 | *Signal vs. noise:* post-spinoff NAND play riding MU's coattails — independent thesis, or just correlation to the memory trade? |
| 4 | **NBIS** | Nebius Group | +4.4% | Bullish | ~16–90, **spiking (~+1,700%)** | 🟢 Signal | 4/5 | *Is this momentum sustainable?* Huge mention spike **+** appears on short-interest lists → genuine squeeze setup or pump? (see §4 cross-flag) |
| 5 | **META** | Meta Platforms | +3.4% (undated) | Bullish | mid | ⚪ Watch | 2/5 | *Spot the noise:* strong AI-score halo — is the chatter about a catalyst or just index-darling drift? |
| 6 | **IREN** | IREN Ltd | n/a | Mixed | rising | ⚪ Watch | 2/5 | *Signal vs. noise:* BTC-miner-to-AI-datacenter pivot story; high-beta. Conviction or lottery ticket? |
| 7 | **CBRS** | Cerebras | n/a | **Bearish** (most bearish name) | ~42 | 🔴 Noise/caution | 1/5 | *Spot the noise:* most-bearish-tagged name — is the attention a short thesis or just IPO-era skepticism? |
| — | ADBE, INTC, MSFT, GOOGL, BMBL | — | — | mixed | mid | ⚪ Watch | 1–2/5 | Secondary mentions; no standout catalyst surfaced this run. |

\* "Recent move" = last-session mention-tracker price change (AltIndex), **not**
a live quote. NVDA close ($226.32, −1.29%, Oct 12) is the only independently
confirmed figure.

**Signal quality / noise read:** The top of the board is dominated by
permanent mega-caps (NVDA, META, MSFT, GOOGL) — high *buzz*, low *incremental
signal*. The tradeable **signal** this run is the **memory/AI-infra cluster**
(MU, SNDK, NBIS) moving together with bullish sentiment, and the **NBIS spike**
which is corroborated outside the mention trackers.

---

## 2. Reddit-sourced discussion (r/wallstreetbets, r/shortsqueeze, r/wallstreetbetsGER)

| Community | What's gaining momentum | Sentiment / conviction |
|-----------|-------------------------|------------------------|
| **r/wallstreetbets** | MU, SNDK, NVDA, NBIS (AI-memory/infra cluster); META, TSLA in the AI-score leaders | Bullish, **medium–high conviction** on the memory trade; NVDA/META mentions are high-volume but low-conviction (habitual) |
| **r/shortsqueeze** | No live r/shortsqueeze feed reachable. Public short-interest lists surface **NBIS, ASTS, FOXA, TEM** (Financhill); microcaps **GRPN, TTAN, TNON** (TheDesperateTrader squeeze-score) | **Low-to-speculative conviction.** Microcap/low-float names = very high risk; short data lags and sources disagree |
| **r/wallstreetbetsGER** | ❌ No live r/wallstreetbetsGER content reachable this run. German retail press (Finanzpost) highlights **Eckert & Ziegler, 2G Energy, Westwing** (small caps) + **Booking, On Holding** — one author's list, *not* community consensus | n/a — **flagged as a gap**, not a trend |

**Conviction note:** WSB sentiment on the memory cluster reads as the most
*organic* (multiple corroborating names moving together). Short-squeeze names
are speculative and the microcaps (GRPN/TTAN/TNON) carry outsized risk.

---

## 3. Confidence scoring legend

| Score | Meaning |
|-------|---------|
| 4–5 | Multi-source corroboration, a spike or catalyst beyond habitual chatter |
| 3 | Real move + coherent thesis, but single-lens |
| 1–2 | High buzz / low incremental signal, or noise/caution |

---

## 4. Cross-source flags (appearing in multiple lenses)

> Because both the "extension board" and the Reddit section draw on the *same*
> Reddit-mention universe this run, inherent overlap isn't meaningful. The flags
> below are names that surface across **independent** lenses (mentions **+**
> short-interest / sentiment):

- 🚩 **NBIS (Nebius)** — on the mention board (bullish, ~+1,700% mention spike)
  **and** on short-interest lists. Momentum + short interest = the run's clearest
  **squeeze-watch** candidate. *Highest cross-source conviction.*
- 🚩 **ASTS (AST SpaceMobile)** — recurring WSB favourite **and** on short-interest
  lists; also in the "WSB 2026 Index." Persistent retail + short overhang.
- ⚠️ **MU + SNDK** — move together (memory/NAND); treat as one correlated trade,
  not two independent signals.

---

## 5. Consolidated watchlist

| Ticker | Why it's here | Lens(es) | Conf. | Primary challenge to resolve |
|--------|---------------|----------|-------|------------------------------|
| **NBIS** | Mention spike + short interest | Board + Short | 4/5 | Squeeze or pump? Check float / days-to-cover live |
| **MU** | Memory-cycle momentum, high mentions | Board + WSB | 3/5 | Earnings re-rate vs. narrative chase |
| **SNDK** | Biggest % move, bullish NAND play | Board + WSB | 3/5 | Independent thesis or just MU correlation? |
| **ASTS** | Persistent retail + short overhang | WSB + Short | 2/5 | Dilution/execution risk vs. squeeze fuel |
| **NVDA** | Benchmark; always-on buzz | Board + WSB | 2/5 | Is today's chatter a catalyst or background noise? |
| **IREN** | AI-datacenter pivot, high beta | Board | 2/5 | Conviction trade or momentum lottery? |
| **GRPN / TTAN / TNON** | Microcap squeeze scores | Short | 1/5 | ⚠️ Extreme risk — size tiny or avoid |

---

### Run summary
- ✅ Report generated from best-available public data.
- ⚠️ **Extension's own APIs (apewisdom.io / tradestie.com) were NOT reachable** —
  data is a ~12–24h-old reconstruction, not a live pre-open board. If live
  data matters, this routine needs those two hosts added to the environment's
  egress allowlist (plus `altindex.com` / `adanos.org` as fallbacks).
- ⚠️ r/wallstreetbetsGER and r/shortsqueeze had **no directly reachable live
  feeds** — those sections are inferred from mirrors/press and flagged as gaps.
- 🔎 Prices are latest-available, not live. Verify at broker before acting. Not advice.

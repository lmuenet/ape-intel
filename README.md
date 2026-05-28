# scalable-intel

A Firefox browser extension that enriches [Scalable Capital](https://de.scalable.capital) stock/ETF pages with real-time community sentiment and news analysis.

## What it does

When you visit a stock, ETF, or other asset on Scalable Capital, the extension injects an analysis panel showing:

- **News** – aggregated from free financial news APIs (Finnhub, MarketAux, Alpha Vantage)
- **Reddit Sentiment** – scraped from investment-focused subreddits (r/wallstreetbets, r/wallstreetbetsGER, r/shortsqueeze, r/stocks, r/investing, r/ValueInvesting, r/Superstonk, r/options, r/StockMarket, r/SecurityAnalysis)
- **Community Score** – bullish/bearish ratio from mentions and comment sentiment
- **StockTwits Stream** – real-time trader messages

## Status

> Planning phase — see `docs/` for design specs.

## Tech Stack

- Firefox WebExtension (Manifest V3)
- Vanilla JS / TypeScript (TBD in planning)
- Reddit JSON API (no auth required for public subreddits)
- Finnhub / MarketAux / Alpha Vantage free tier

## Development

```bash
# Load in Firefox
# Open about:debugging → This Firefox → Load Temporary Add-on → select manifest.json
```

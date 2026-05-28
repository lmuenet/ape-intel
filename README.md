# ape-intel

A Firefox browser extension that enriches [Scalable Capital](https://de.scalable.capital) stock/ETF pages with real-time community sentiment and news analysis.

## What it does

When you visit a stock on Scalable Capital, the extension injects an always-visible Badge plus an on-demand Side Panel showing:

- **Barometer / Buzz / Trend** – confidence-weighted community sentiment fused from Apewisdom, Tradestie and StockTwits (see `docs/adr/0001-…`)
- **News** – Top 5 of the last 7 days from Finnhub (Alpha Vantage as emergency fallback; English only in v1)
- **Earnings Date** – next scheduled earnings with consensus EPS estimate
- **AI Analysis (BYOK)** – optional Anthropic/OpenAI synthesis of a Markdown Briefing; the Briefing is also exportable to any external LLM

## Status

> Early development — see `docs/PRD.md` for the product spec and `docs/adr/` for binding architecture decisions.

## Tech Stack

- Firefox WebExtension (Manifest V3)
- TypeScript + Vite + `@crxjs/vite-plugin` + Preact
- Vitest for unit tests
- Data sources: Apewisdom, Tradestie, StockTwits, OpenFIGI, Finnhub, Alpha Vantage (fallback)

## Development

```bash
# Load in Firefox
# Open about:debugging → This Firefox → Load Temporary Add-on → select manifest.json
```

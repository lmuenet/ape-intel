# Ape Intel

A Firefox (Manifest V3) browser extension that augments a supported broker's
security pages with community sentiment, news, and an AI-assisted second opinion —
so you can form a pre-purchase view on a single stock without leaving your broker.

Supported brokers: **Scalable Capital** and **Smartbroker+** (added via a Broker
registry — see `docs/adr/0006-…`).

## What it does

On a supported broker's stock page, the extension shows an always-visible **Badge**
(bottom-right) plus an on-demand **Side Panel**:

- **Barometer / Buzz / Trend** — a confidence-weighted community-sentiment score
  fused from Apewisdom, Tradestie and StockTwits, alongside mention volume (Buzz)
  and 24h momentum (Trend). See `docs/adr/0001-…`.
- **Per-source breakdown** — each source's contribution, shown explicitly (a source
  with no data is never silently dropped).
- **News** — top 5 of the last 7 days from Finnhub, each tagged with a catalyst.
- **Earnings date** — the next scheduled report with consensus EPS estimate.
- **Coverage state** — every asset is flagged **Covered**, **Thin**, or **Uncovered**
  so an empty panel is never ambiguous.
- **Favourites** — pin up to 20 assets (★); a once-daily background job records a
  7-day momentum sparkline for each.
- **Manual refresh** — a per-asset "fetch now" button (3-minute cooldown).

### AI second opinion (copy-out)

v1 ships the AI path **copy-out only** — no API keys, no per-call cost, works with
whatever LLM you already use (see `docs/adr/0010-…`):

- One click copies a Markdown **Briefing** + an editable **Export Prompt** to your
  clipboard; paste it into Claude, ChatGPT, Gemini, or a local model.
- The prompt casts the model as a skeptical analyst, has it weigh an explicit bull
  vs. bear case, and asks for a structured strategy.
- A per-export **Trading Profile** (risk appetite + horizon, set in the Side Panel)
  is injected as a *preference the model must validate*, not a command.
- Paste the model's answer back into the Side Panel to render the parsed strategy.

### Trending Board

A cross-asset discovery view (ranked by Apewisdom mentions) with a Favourites
companion, reachable from the Badge (in-page modal) and the toolbar popup. An
optional, copy-out **AI Challenge** triages the list into signal / noise / watch.

### Settings (Options page)

A dedicated options page (`about:addons` → Preferences): save/delete the Finnhub
key, edit the base Export Prompt, choose the log level, and view/filter/copy/clear
the structured log buffer.

### Privacy

No telemetry, no analytics, no error reporting. The only outbound calls are to the
listed data sources and — only if you paste it yourself — your chosen LLM. The
Finnhub key is stored locally (`browser.storage.local`).

## Tech stack

- Firefox WebExtension (Manifest V3)
- TypeScript · Vite · `@crxjs/vite-plugin` · Preact
- Vitest (unit tests)
- Data sources: Apewisdom, Tradestie, StockTwits, OpenFIGI, Finnhub

## Development

```bash
npm install
npm run dev        # Vite dev build (HMR)
npm run test       # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run build      # production build → dist/
```

Load it in Firefox: `about:debugging` → **This Firefox** → **Load Temporary
Add-on** → pick `dist/manifest.json` (after `npm run build`). Temporary add-ons are
unsigned and reset on browser restart.

## Documentation

- `docs/PRD.md` — product spec
- `CONTEXT.md` — domain glossary
- `docs/adr/` — binding architecture decisions
- `docs/superpowers/specs/` and `…/plans/` — per-feature designs and implementation plans

## License

Personal project; all rights reserved unless stated otherwise.

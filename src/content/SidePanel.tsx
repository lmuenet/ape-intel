import "./sidePanel.css";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { ExternalLinksBar } from "./ExternalLinksBar";

export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
  onClose: () => void;
  onTradingViewClick: () => void;
}

function trendArrow(now: number, prev: number): string {
  if (now > prev) return "↑";
  if (now < prev) return "↓";
  return "→";
}

function bullishRatio(bullish: number, bearish: number): string {
  const total = bullish + bearish;
  if (total === 0) return "—";
  return `${Math.round((bullish / total) * 100)}%`;
}

function Placeholder({ children }: { children: preact.ComponentChildren }) {
  return <p class="ape-intel-panel__placeholder">{children}</p>;
}

function StockTwitsSection({ entry }: { entry: StockTwitsEntry | null | undefined }) {
  return (
    <section class="ape-intel-panel__source ape-intel-panel__source--stocktwits">
      <h3 class="ape-intel-panel__section-title">StockTwits</h3>
      {entry === undefined ? <Placeholder>Loading…</Placeholder>
      : entry === null ? <Placeholder>No StockTwits data for this ticker.</Placeholder>
      : (
        <div class="ape-intel-panel__stocktwits">
          <div class="ape-intel-panel__stocktwits-ratio">
            {bullishRatio(entry.bullish, entry.bearish)}
            <span class="ape-intel-panel__stocktwits-ratio-label">bullish</span>
          </div>
          <dl class="ape-intel-panel__stats ape-intel-panel__stats--three">
            <div><dt>Bullish</dt><dd>{entry.bullish}</dd></div>
            <div><dt>Bearish</dt><dd>{entry.bearish}</dd></div>
            <div><dt>Messages</dt><dd>{entry.totalMessages}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}

function ApewisdomSection({ entry }: { entry: ApewisdomEntry | null | undefined }) {
  return (
    <section class="ape-intel-panel__source">
      <h3 class="ape-intel-panel__section-title">Apewisdom (Buzz + Trend)</h3>
      {entry === undefined ? <Placeholder>Loading…</Placeholder>
      : entry === null ? <Placeholder>No Apewisdom data — ticker not in current top 250 trending.</Placeholder>
      : (
        <dl class="ape-intel-panel__stats ape-intel-panel__stats--two">
          <div>
            <dt>Mentions</dt>
            <dd>{entry.mentions}{" "}<span class="ape-intel-panel__trend">{trendArrow(entry.mentions, entry.mentions24hAgo)}</span></dd>
          </div>
          <div><dt>Rank</dt><dd>#{entry.rank}</dd></div>
        </dl>
      )}
    </section>
  );
}

export function SidePanel({
  isOpen, ticker, apewisdom, stocktwits, onClose, onTradingViewClick,
}: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside class="ape-intel-panel" aria-label="Ape Intel side panel">
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">{ticker ?? "Resolving ticker…"}</h2>
        <button type="button" class="ape-intel-panel__close" aria-label="Close side panel" onClick={onClose}>×</button>
      </header>
      <StockTwitsSection entry={stocktwits} />
      <ApewisdomSection entry={apewisdom} />
      <ExternalLinksBar ticker={ticker} onTradingViewClick={onTradingViewClick} />
    </aside>
  );
}

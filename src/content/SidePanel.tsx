import "./sidePanel.css";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW, computeTrend } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";
import { ExternalLinksBar } from "./ExternalLinksBar";
import { NewsSection, EarningsRow } from "./NewsSection";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import { SparklineSection } from "./Sparkline";
import type { DailySnapshot } from "../lib/snapshot-history";

export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  aggregate: Aggregate | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
  news: NewsItem[] | null | undefined;
  earnings: EarningsDate | null | undefined;
  finnhubKey: string | null | undefined;
  onSaveKey: (key: string) => void;
  isFavourite: boolean;
  showCapHint: boolean;
  onToggleFavourite: () => void;
  history: DailySnapshot[] | null | undefined;
  onClose: () => void;
  onTradingViewClick: () => void;
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
            <dd>{entry.mentions}{" "}<span class="ape-intel-panel__trend">{TREND_ARROW[computeTrend({ apewisdom: entry })]}</span></dd>
          </div>
          <div><dt>Rank</dt><dd>#{entry.rank}</dd></div>
        </dl>
      )}
    </section>
  );
}

function scoreText(score: number | null): string {
  if (score === null) return "—";
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

function BarometerSection({ aggregate }: { aggregate: Aggregate | null | undefined }) {
  return (
    <section class="ape-intel-panel__barometer">
      <h3 class="ape-intel-panel__section-title">Barometer</h3>
      {aggregate === undefined ? <Placeholder>Loading…</Placeholder>
      : aggregate === null ? <Placeholder>No Barometer data.</Placeholder>
      : (
        <div class="ape-intel-panel__barometer-body">
          <div class="ape-intel-panel__barometer-headline">
            <span
              class="ape-intel-panel__barometer-label"
              data-label={aggregate.barometer.label}
            >
              {BAROMETER_LABEL_TEXT[aggregate.barometer.label]}
            </span>
            <span class="ape-intel-panel__barometer-score">
              {scoreText(aggregate.barometer.score)}
            </span>
          </div>
          {aggregate.barometer.label !== "unavailable" && aggregate.barometer.lowConfidence ? (
            <p class="ape-intel-panel__barometer-note">
              low confidence · {aggregate.barometer.contributingSources}{" "}
              source{aggregate.barometer.contributingSources === 1 ? "" : "s"}
            </p>
          ) : null}
          <dl class="ape-intel-panel__stats ape-intel-panel__stats--two">
            <div><dt>Buzz</dt><dd>{BUZZ_TEXT[aggregate.buzz.level]}</dd></div>
            <div><dt>Trend</dt><dd>{TREND_ARROW[aggregate.trend]}</dd></div>
          </dl>
        </div>
      )}
    </section>
  );
}

export function SidePanel({
  isOpen, ticker, aggregate, apewisdom, stocktwits,
  news, earnings, finnhubKey, onSaveKey,
  isFavourite, showCapHint, onToggleFavourite, history,
  onClose, onTradingViewClick,
}: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside class="ape-intel-panel" aria-label="Ape Intel side panel">
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">{ticker ?? "Resolving ticker…"}</h2>
        <div class="ape-intel-panel__header-actions">
          {ticker ? (
            <button
              type="button"
              class="ape-intel-panel__star"
              aria-pressed={isFavourite}
              aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
              onClick={onToggleFavourite}
            >
              {isFavourite ? "★" : "☆"}
            </button>
          ) : null}
          <button type="button" class="ape-intel-panel__close" aria-label="Close side panel" onClick={onClose}>×</button>
        </div>
      </header>
      {ticker && showCapHint ? <p class="ape-intel-panel__cap-hint">Max 20 favourites.</p> : null}
      <BarometerSection aggregate={aggregate} />
      <StockTwitsSection entry={stocktwits} />
      <ApewisdomSection entry={apewisdom} />
      {ticker ? (
        <>
          {finnhubKey ? <EarningsRow earnings={earnings} /> : null}
          <NewsSection hasKey={!!finnhubKey} news={news} onSaveKey={onSaveKey} />
        </>
      ) : null}
      {ticker && isFavourite ? <SparklineSection history={history} /> : null}
      <ExternalLinksBar ticker={ticker} onTradingViewClick={onTradingViewClick} />
    </aside>
  );
}

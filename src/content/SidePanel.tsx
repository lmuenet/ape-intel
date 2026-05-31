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
import { StrategySection } from "./StrategySection";
import type { StoredStrategy } from "../lib/strategy";
import { COVERAGE_TEXT, COVERAGE_DETAIL, type Coverage } from "../lib/coverage";
import type { TradingProfile, RiskAppetite, Horizon } from "../lib/briefing";

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
  copyState: "idle" | "copied" | "error";
  onCopyBriefing: () => void;
  profile: TradingProfile;
  onProfileChange: (profile: TradingProfile) => void;
  strategy: StoredStrategy | null | undefined;
  parseError: boolean;
  onSaveStrategy: (raw: string) => void;
  onClearStrategy: () => void;
  coverage: Coverage;
  onClose: () => void;
  onTradingViewClick: () => void;
  onRefresh: () => void;
  /** Epoch ms until which manual refresh is on cooldown, or null if available. */
  refreshDisabledUntil: number | null;
}

function refreshTitle(disabledUntil: number | null): string {
  if (disabledUntil === null) return "Refresh data for this asset";
  const remainingMs = disabledUntil - Date.now();
  if (remainingMs <= 0) return "Refresh data for this asset";
  const mins = Math.ceil(remainingMs / 60_000);
  return `Refresh available in ~${mins} min`;
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
  isFavourite, showCapHint, onToggleFavourite, history, copyState, onCopyBriefing,
  profile, onProfileChange,
  strategy, parseError, onSaveStrategy, onClearStrategy, coverage,
  onClose, onTradingViewClick, onRefresh, refreshDisabledUntil,
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
              class="ape-intel-panel__refresh"
              aria-label="Refresh data for this asset"
              title={refreshTitle(refreshDisabledUntil)}
              disabled={refreshDisabledUntil !== null && Date.now() < refreshDisabledUntil}
              onClick={onRefresh}
            >
              ↻
            </button>
          ) : null}
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
      {coverage !== "unknown" ? (
        <p class="ape-intel-panel__coverage" data-coverage={coverage}>
          <span class="ape-intel-panel__coverage-label">{COVERAGE_TEXT[coverage]}</span>
          <span class="ape-intel-panel__coverage-detail">{COVERAGE_DETAIL[coverage]}</span>
        </p>
      ) : null}
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
      {ticker ? (
        <section class="ape-intel-panel__source ape-intel-briefing">
          <h3 class="ape-intel-panel__section-title">AI Briefing</h3>
          <div class="ape-intel-briefing__knobs">
            <label class="ape-intel-briefing__knob">
              <span>Risk</span>
              <select
                aria-label="Risk appetite"
                value={profile.risk}
                onChange={(e) =>
                  onProfileChange({ ...profile, risk: (e.currentTarget as HTMLSelectElement).value as RiskAppetite })
                }
              >
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </label>
            <label class="ape-intel-briefing__knob">
              <span>Horizon</span>
              <select
                aria-label="Horizon"
                value={profile.horizon}
                onChange={(e) =>
                  onProfileChange({ ...profile, horizon: (e.currentTarget as HTMLSelectElement).value as Horizon })
                }
              >
                <option value="intraday">Intraday</option>
                <option value="swing">Swing</option>
                <option value="position">Position</option>
              </select>
            </label>
          </div>
          <button type="button" class="ape-intel-briefing__copy" onClick={onCopyBriefing}>
            {copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy briefing for AI"}
          </button>
        </section>
      ) : null}
      {ticker ? (
        <StrategySection
          strategy={strategy}
          parseError={parseError}
          onSaveStrategy={onSaveStrategy}
          onClearStrategy={onClearStrategy}
        />
      ) : null}
      <ExternalLinksBar ticker={ticker} onTradingViewClick={onTradingViewClick} />
    </aside>
  );
}

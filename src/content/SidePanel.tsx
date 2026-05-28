import "./sidePanel.css";
import type { ApewisdomEntry } from "../lib/apewisdom";

export interface SidePanelProps {
  isOpen: boolean;
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  onClose: () => void;
}

function trendArrow(mentions: number, mentions24hAgo: number): string {
  if (mentions > mentions24hAgo) return "↑";
  if (mentions < mentions24hAgo) return "↓";
  return "→";
}

export function SidePanel({ isOpen, ticker, apewisdom, onClose }: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <aside class="ape-intel-panel" aria-label="Ape Intel side panel">
      <header class="ape-intel-panel__header">
        <h2 class="ape-intel-panel__title">
          {ticker ?? "Resolving ticker…"}
        </h2>
        <button
          type="button"
          class="ape-intel-panel__close"
          aria-label="Close side panel"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <section class="ape-intel-panel__section">
        <h3 class="ape-intel-panel__section-title">Apewisdom</h3>
        {apewisdom === undefined ? (
          <p class="ape-intel-panel__placeholder">Loading…</p>
        ) : apewisdom === null ? (
          <p class="ape-intel-panel__placeholder">
            No Apewisdom data — ticker not in current top 250 trending.
          </p>
        ) : (
          <dl class="ape-intel-panel__stats">
            <div>
              <dt>Mentions</dt>
              <dd>
                {apewisdom.mentions}{" "}
                <span class="ape-intel-panel__trend">
                  {trendArrow(apewisdom.mentions, apewisdom.mentions24hAgo)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Sentiment</dt>
              <dd>{apewisdom.sentimentScore} / 100</dd>
            </div>
            <div>
              <dt>Rank</dt>
              <dd>#{apewisdom.rank}</dd>
            </div>
          </dl>
        )}
      </section>
    </aside>
  );
}

import "./badge.css";
import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW } from "../lib/barometer";
import type { Aggregate } from "../lib/barometer";
import { COVERAGE_TEXT, type Coverage } from "../lib/coverage";

export interface BadgeProps {
  isin: string;
  ticker?: string | null;
  aggregate?: Aggregate | null;
  coverage?: Coverage;
  onClick?: () => void;
}

export function Badge({ isin, ticker, aggregate, coverage, onClick }: BadgeProps) {
  return (
    <button
      type="button"
      class="ape-intel-badge"
      aria-label="Open Ape Intel side panel"
      onClick={onClick}
    >
      <span class="ape-intel-badge__brand">Ape Intel</span>
      {coverage && coverage !== "unknown" ? (
        <span
          class="ape-intel-badge__coverage"
          data-coverage={coverage}
          aria-label={`Coverage: ${COVERAGE_TEXT[coverage]}`}
        />
      ) : null}
      <span class="ape-intel-badge__isin">{isin}</span>
      {ticker ? (
        <span class="ape-intel-badge__ticker">{ticker}</span>
      ) : null}
      {aggregate ? (
        <span class="ape-intel-badge__barometer">
          <span class="ape-intel-badge__barometer-label">
            {BAROMETER_LABEL_TEXT[aggregate.barometer.label]}
          </span>
          <span class="ape-intel-badge__buzz">{BUZZ_TEXT[aggregate.buzz.level]}</span>
          <span class="ape-intel-badge__trend">{TREND_ARROW[aggregate.trend]}</span>
        </span>
      ) : null}
    </button>
  );
}

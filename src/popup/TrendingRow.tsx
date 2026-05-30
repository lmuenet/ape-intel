import { computeTrend, TREND_ARROW, type TrendDirection } from "../lib/barometer";
import type { TrendingRow as Row } from "../background/apewisdom-service";

const TREND_CLASS: Record<TrendDirection, string> = {
  up: "ape-row__trend--up",
  down: "ape-row__trend--down",
  flat: "ape-row__trend--flat",
  unknown: "ape-row__trend--flat",
};

export function TrendingRow({ row }: { row: Row }) {
  const trend = computeTrend({ apewisdom: row });
  return (
    <div class="ape-row">
      <span class="ape-row__rank">{row.rank}</span>
      <span class="ape-row__id">
        <span class="ape-row__ticker">{row.ticker}</span>
        <span class="ape-row__name">{row.name ?? row.ticker}</span>
      </span>
      <span class="ape-row__mentions">{row.mentions} mentions</span>
      <span class={`ape-row__trend ${TREND_CLASS[trend]}`} aria-label={`trend ${trend}`}>
        {TREND_ARROW[trend]}
      </span>
    </div>
  );
}

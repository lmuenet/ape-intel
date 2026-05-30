import { computeTrend, TREND_ARROW, type TrendDirection } from "../lib/barometer";
import type { TrendingRow as Row } from "../background/apewisdom-service";
import type { TickerVerdict, Verdict } from "../lib/trending-challenge";

const TREND_CLASS: Record<TrendDirection, string> = {
  up: "ape-row__trend--up",
  down: "ape-row__trend--down",
  flat: "ape-row__trend--flat",
  unknown: "ape-row__trend--flat",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  signal: "Signal",
  noise: "Noise",
  watch: "Watch",
};

export function TrendingRow({ row, verdict }: { row: Row; verdict?: TickerVerdict }) {
  const trend = computeTrend({ apewisdom: row });
  return (
    <div class="ape-row">
      <div class="ape-row__main">
        <span class="ape-row__rank">{row.rank}</span>
        <span class="ape-row__id">
          <span class="ape-row__ticker">{row.ticker}</span>
          <span class="ape-row__name">{row.name ?? row.ticker}</span>
        </span>
        {verdict ? (
          <span class={`ape-verdict ape-verdict--${verdict.verdict}`}>{VERDICT_LABEL[verdict.verdict]}</span>
        ) : null}
        <span class="ape-row__mentions">{row.mentions} mentions</span>
        <span class={`ape-row__trend ${TREND_CLASS[trend]}`} aria-label={`trend ${trend}`}>
          {TREND_ARROW[trend]}
        </span>
      </div>
      {verdict?.thesis ? <p class="ape-row__thesis">{verdict.thesis}</p> : null}
    </div>
  );
}

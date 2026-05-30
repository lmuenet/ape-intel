import { computeTrend, TREND_ARROW } from "../lib/barometer";
import { Sparkline } from "../content/Sparkline";
import type { FavouriteRow as Row } from "../background/favourites-board";

export function FavouriteRow({ row }: { row: Row }) {
  const { standing, history } = row;
  const trend = standing ? computeTrend({ apewisdom: standing }) : "unknown";
  return (
    <div class="ape-fav">
      <div class="ape-fav__head">
        <span class="ape-row__id">
          <span class="ape-row__ticker">{row.ticker}</span>
          <span class="ape-row__name">{standing?.name ?? row.ticker}</span>
        </span>
        {standing ? (
          <span class="ape-fav__standing">
            {standing.mentions} mentions <span class="ape-row__trend">{TREND_ARROW[trend]}</span>
          </span>
        ) : (
          <span class="ape-fav__quiet">Not trending</span>
        )}
      </div>
      {history.length >= 2 ? (
        <Sparkline values={history.map((d) => d.mentions)} />
      ) : (
        <p class="ape-popup__hint ape-fav__collecting">Collecting data ({history.length}/7)…</p>
      )}
    </div>
  );
}

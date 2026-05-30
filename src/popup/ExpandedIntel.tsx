import {
  aggregate as computeAggregate,
  BAROMETER_LABEL_TEXT,
  BUZZ_TEXT,
  TREND_ARROW,
} from "../lib/barometer";
import { CATALYST_LABEL } from "../lib/catalyst";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { StockTwitsEntry } from "../lib/stocktwits";
import type { EarningsDate, NewsItem } from "../lib/finnhub";

export interface ExpandedIntelProps {
  ticker: string;
  apewisdom: ApewisdomEntry | null;
  stocktwits: StockTwitsEntry | null | undefined;
  news: NewsItem[] | null | undefined;
  earnings: EarningsDate | null | undefined;
  hasKey: boolean;
}

export function ExpandedIntel(props: ExpandedIntelProps) {
  const loading = props.stocktwits === undefined;
  const agg = loading
    ? undefined
    : computeAggregate({ stocktwits: props.stocktwits ?? null, apewisdom: props.apewisdom });

  return (
    <div class="ape-x">
      {agg === undefined ? (
        <p class="ape-popup__hint">Loading…</p>
      ) : (
        <dl class="ape-x__signals">
          <div>
            <dt>Barometer</dt>
            <dd>
              {agg.barometer.label === "unavailable" || agg.barometer.score === null
                ? "No sentiment data"
                : BAROMETER_LABEL_TEXT[agg.barometer.label]}
            </dd>
          </div>
          <div>
            <dt>Buzz</dt>
            <dd>{BUZZ_TEXT[agg.buzz.level]}</dd>
          </div>
          <div>
            <dt>Trend</dt>
            <dd>{TREND_ARROW[agg.trend]}</dd>
          </div>
        </dl>
      )}

      {props.stocktwits ? (
        <p class="ape-x__stocktwits">
          StockTwits: {props.stocktwits.bullish} bullish / {props.stocktwits.bearish} bearish
        </p>
      ) : null}

      {!props.hasKey ? (
        <p class="ape-popup__hint">Add a Finnhub key on a broker page for news &amp; earnings.</p>
      ) : (
        <>
          {props.news && props.news.length > 0 ? (
            <ul class="ape-x__news">
              {props.news.map((it) => (
                <li key={it.url}>
                  <a href={it.url} target="_blank" rel="noopener noreferrer">
                    {it.headline}
                  </a>
                  <span class="ape-x__news-tag">{CATALYST_LABEL[it.catalyst]}</span>
                </li>
              ))}
            </ul>
          ) : props.news === undefined ? (
            <p class="ape-popup__hint">Loading news…</p>
          ) : (
            <p class="ape-popup__hint">No news in the last 7 days.</p>
          )}
          {props.earnings ? (
            <p class="ape-x__earnings">
              Next earnings: {props.earnings.date}
              {props.earnings.epsEstimate !== null ? ` · EPS est. ${props.earnings.epsEstimate}` : ""}
            </p>
          ) : null}
        </>
      )}

      <nav class="ape-x__links" aria-label="External tools">
        <a href={`https://stocktwits.com/symbol/${props.ticker}`} target="_blank" rel="noopener noreferrer">
          StockTwits
        </a>
        <a href={`https://www.tradingview.com/symbols/${props.ticker}/`} target="_blank" rel="noopener noreferrer">
          TradingView
        </a>
      </nav>
    </div>
  );
}

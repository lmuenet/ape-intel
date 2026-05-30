import { BAROMETER_LABEL_TEXT, BUZZ_TEXT, type Aggregate, type TrendDirection } from "./barometer";
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";
import type { EarningsDate, NewsItem } from "./finnhub";
import { CATALYST_LABEL } from "./catalyst";

export interface BriefingInput {
  ticker: string;
  aggregate: Aggregate | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
  news: NewsItem[] | null | undefined;
  earnings: EarningsDate | null | undefined;
}

const TREND_WORD: Record<TrendDirection, string> = {
  up: "rising",
  flat: "flat",
  down: "falling",
  unknown: "unknown",
};

function newsDate(datetime: number): string {
  return new Date(datetime * 1000).toISOString().slice(0, 10);
}

export function assembleBriefing(input: BriefingInput): string {
  const lines: string[] = [];
  lines.push(`# Ape Intel Briefing — ${input.ticker}`, "");

  const agg = input.aggregate;

  lines.push("## Barometer");
  if (agg && agg.barometer.label !== "unavailable" && agg.barometer.score !== null) {
    lines.push(`${BAROMETER_LABEL_TEXT[agg.barometer.label]} (score ${agg.barometer.score.toFixed(2)})`);
    if (agg.barometer.lowConfidence) {
      const n = agg.barometer.contributingSources;
      lines.push(`Low confidence (${n} source${n === 1 ? "" : "s"}).`);
    }
  } else {
    lines.push("No sentiment data.");
  }
  lines.push("");

  lines.push("## Buzz & Trend");
  if (agg) {
    lines.push(`Buzz: ${BUZZ_TEXT[agg.buzz.level]}${agg.buzz.mentions !== null ? ` (${agg.buzz.mentions} mentions)` : ""}`);
    lines.push(`Trend: ${TREND_WORD[agg.trend]}`);
  } else {
    lines.push("No buzz/trend data.");
  }
  lines.push("");

  lines.push("## Community");
  lines.push(
    input.stocktwits
      ? `StockTwits: ${input.stocktwits.bullish} bullish / ${input.stocktwits.bearish} bearish (${input.stocktwits.totalMessages} messages)`
      : "StockTwits: no data.",
  );
  lines.push(
    input.apewisdom
      ? `Apewisdom: ${input.apewisdom.mentions} mentions, rank #${input.apewisdom.rank}`
      : "Apewisdom: no data.",
  );
  lines.push("");

  lines.push("## Earnings");
  lines.push(
    input.earnings
      ? `Next: ${input.earnings.date}${input.earnings.epsEstimate !== null ? `, EPS est. ${input.earnings.epsEstimate}` : ""}`
      : "No upcoming earnings.",
  );
  lines.push("");

  lines.push("## News");
  if (input.news && input.news.length > 0) {
    for (const it of input.news) {
      lines.push(`- ${it.headline} (${it.source}, ${newsDate(it.datetime)}) [${CATALYST_LABEL[it.catalyst]}]`);
    }
  } else {
    lines.push("No recent news.");
  }

  return lines.join("\n");
}

export const EXPORT_PROMPT = [
  "You are a sober equity-research assistant. Below is a structured briefing about a single stock,",
  "assembled by a browser extension from community-sentiment and news sources. Analyse it and respond",
  "in three readable sections:",
  "",
  "1. **What the community is saying** — synthesise the sentiment and buzz signals.",
  "2. **What the news is saying** — summarise the headlines and likely catalysts.",
  "3. **What to watch out for** — risks, caveats, and what would change the picture.",
  "",
  "Do NOT give a buy or sell recommendation. You are not a financial advisor; this is informational only.",
  "",
  "After the three sections, output a single fenced ```json code block mirroring your analysis, using",
  "exactly these keys:",
  "",
  "```json",
  '{ "community": "…", "news": "…", "watchOuts": "…" }',
  "```",
].join("\n");

export function buildClipboardPayload(input: BriefingInput): string {
  return `${EXPORT_PROMPT}\n\n${assembleBriefing(input)}`;
}

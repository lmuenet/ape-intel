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
  "You are a sharp, skeptical equity analyst helping me form a short-to-medium-term trading view on a",
  "single stock. Below is a briefing my browser extension assembled from community-sentiment and news",
  "sources. Treat it ONLY as a starting point — not as ground truth.",
  "",
  "Your task:",
  "",
  "1. Analyse this specific stock for a short-to-medium-term trade.",
  '2. Critically challenge the briefing\'s "Barometer" sentiment reading. Do not take it at face value —',
  "   look for why it could be misleading, biased or stale (e.g. self-tagged StockTwits bias, small",
  "   sample size, hype vs. fundamentals, stale data).",
  "3. Do your OWN independent research to form your own picture: search the web, recent news and",
  "   filings, Reddit (e.g. r/wallstreetbets and other relevant subreddits), StockTwits and other",
  "   retail/finance portals. Do not rely on my data alone.",
  "4. Then give me a concrete short-to-medium-term trading strategy, including:",
  '   - Direction: long or short (or "stay out", with reasoning)',
  "   - Timeframe / holding horizon",
  "   - Target price(s) and a stop / invalidation level",
  "   - A leverage suggestion, and the risk that leverage adds",
  "   - Which instrument(s) to use (shares, options, CFDs / leverage products), plus a rough",
  "     position sizing / stake suggestion",
  "   - The key rationale and the main risks",
  "",
  "Be direct and specific with numbers where you reasonably can. This is for my own informational",
  "research and personal decision-making, not regulated financial advice.",
  "",
  "At the end, output a single fenced ```json code block mirroring your strategy, using exactly these",
  "keys:",
  "",
  "```json",
  "{",
  '  "direction": "long | short | stay-out",',
  '  "timeframe": "...",',
  '  "targetPrice": "...",',
  '  "stopLoss": "...",',
  '  "leverage": "...",',
  '  "instruments": "...",',
  '  "positionSizing": "...",',
  '  "barometerCritique": "...",',
  '  "rationale": "...",',
  '  "risks": "..."',
  "}",
  "```",
].join("\n");

export function buildClipboardPayload(input: BriefingInput): string {
  return `${EXPORT_PROMPT}\n\n${assembleBriefing(input)}`;
}

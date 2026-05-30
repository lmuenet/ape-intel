import { computeTrend, type TrendDirection } from "./barometer";
import type { TrendingRow } from "../background/apewisdom-service";

const TREND_WORD: Record<TrendDirection, string> = {
  up: "rising",
  flat: "flat",
  down: "falling",
  unknown: "unknown",
};

export function assembleTrendingBriefing(rows: TrendingRow[]): string {
  const lines: string[] = ["# Ape Intel — Trending candidates", ""];
  for (const row of rows) {
    const trend = computeTrend({ apewisdom: row });
    const label = row.name ? `${row.ticker} (${row.name})` : row.ticker;
    lines.push(`${row.rank}. ${label} — ${row.mentions} mentions, ${TREND_WORD[trend]}`);
  }
  return lines.join("\n");
}

export const TRENDING_EXPORT_PROMPT = [
  "You are a sharp, skeptical equity analyst. Below is today's list of stocks that are trending in",
  "retail/community chatter (by mention volume). Treat it ONLY as a starting point — high chatter is",
  "not the same as a good trade.",
  "",
  "Your task is to PRE-FILTER this list before I decide what to dig into:",
  "",
  "1. For each ticker, decide whether the attention is justified. Do your own quick research (recent",
  "   news, filings, price action, a broad range of sources — not just one) rather than trusting the",
  "   chatter or the mention count.",
  "2. Flag the duds: tickers that are loud but do NOT deserve the attention (pure meme pump, stale",
  "   news, nothing behind the move).",
  "3. Surface the ones genuinely worth a closer look, and the ones merely worth watching.",
  "",
  "Classify each ticker with a verdict:",
  '- "signal" = worth following / the attention is justified',
  '- "noise"  = a dud, the trend is not deserved',
  '- "watch"  = unclear, keep an eye on it',
  "",
  "Output a single fenced ```json block with this exact shape:",
  "",
  "```json",
  "{",
  '  "summary": "one or two sentences: overall read of the list",',
  '  "verdicts": [',
  '    { "ticker": "TSLA", "verdict": "signal | noise | watch", "thesis": "one concise line", "watch": "the key catalyst to watch (optional)" }',
  "  ]",
  "}",
  "```",
  "",
  "Cover every ticker from the list. Be direct. This is for my own informational research and personal",
  "decision-making, not regulated financial advice.",
].join("\n");

export function buildTrendingClipboardPayload(rows: TrendingRow[]): string {
  return `${TRENDING_EXPORT_PROMPT}\n\n${assembleTrendingBriefing(rows)}`;
}

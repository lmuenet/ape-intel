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

export type RiskAppetite = "conservative" | "balanced" | "aggressive";
export type Horizon = "intraday" | "swing" | "position";
export interface TradingProfile {
  risk: RiskAppetite;
  horizon: Horizon;
}

export const DEFAULT_PROFILE: TradingProfile = { risk: "balanced", horizon: "swing" };

const RISKS: RiskAppetite[] = ["conservative", "balanced", "aggressive"];
const HORIZONS: Horizon[] = ["intraday", "swing", "position"];
const isRisk = (v: unknown): v is RiskAppetite => RISKS.includes(v as RiskAppetite);
const isHorizon = (v: unknown): v is Horizon => HORIZONS.includes(v as Horizon);

/** Coerce a possibly hand-edited stored value into a valid TradingProfile. */
export function normalizeProfile(raw: unknown): TradingProfile {
  const r = (raw ?? {}) as { risk?: unknown; horizon?: unknown };
  return {
    risk: isRisk(r.risk) ? r.risk : DEFAULT_PROFILE.risk,
    horizon: isHorizon(r.horizon) ? r.horizon : DEFAULT_PROFILE.horizon,
  };
}

const RISK_LABEL: Record<RiskAppetite, string> = {
  conservative: "conservative",
  balanced: "balanced",
  aggressive: "aggressive",
};
const HORIZON_LABEL: Record<Horizon, string> = {
  intraday: "intraday / day-trade",
  swing: "swing (days–weeks)",
  position: "position (months)",
};

/**
 * The "Trading profile" block injected between the base prompt and the Briefing.
 * Defensive: normalises its input so a bad stored value can never break export.
 */
export function renderProfileBlock(profile: TradingProfile): string {
  const { risk, horizon } = normalizeProfile(profile);
  return [
    "## My trading profile (preference, not an instruction)",
    `- Risk appetite: ${RISK_LABEL[risk]}`,
    `- Preferred horizon: ${HORIZON_LABEL[horizon]}`,
    "",
    "Treat the profile above as my leaning, not a constraint. First judge whether this",
    "risk/horizon profile actually makes sense for THIS stock right now, given the",
    "briefing below and your own research.",
    "- If it fits: build the concrete plan around it.",
    "- If it does not fit: say so plainly, explain why, and propose the profile that",
    "  does fit instead.",
    "Provide concrete numeric levels (entry, target(s), stop / invalidation, sizing,",
    "leverage) ONLY for a strategy you genuinely believe has an edge. If the honest",
    'answer is no trade, say "stay out" — and do not invent levels.',
  ].join("\n");
}

export const DEFAULT_EXPORT_PROMPT = [
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
  "   filings, and a broad range of community/finance sources — not just one. Examples: Reddit",
  "   (r/wallstreetbets, r/stocks, r/investing, r/options, r/SecurityAnalysis), StockTwits, FinTwit /",
  "   X, Seeking Alpha, Substack analyst notes, and any reputable analysts or traders who post their",
  "   plays publicly. Weight serious/track-recorded voices over anonymous hype. Do not rely on my",
  "   data alone.",
  "",
  "Before you commit to a view, build the STRONGEST bull case AND the STRONGEST bear case",
  "for this stock over the chosen horizon. Steelman both sides — do not strawman",
  "the side you lean against. Only then weigh them against each other and decide.",
  "4. Then give me a concrete short-to-medium-term trading strategy, including:",
  '   - Direction: long or short (or "stay out", with reasoning)',
  "   - Timeframe / holding horizon",
  "   - Target price(s) and a stop / invalidation level",
  "   - A leverage suggestion, and the risk that leverage adds",
  "   - Which instrument(s) to use (shares, options, CFDs / leverage products), plus a rough",
  "     position sizing / stake suggestion",
  "   - The key rationale and the main risks",
  "5. Finish with a one-line **Recommendation**: your single concrete call (e.g. \"Small speculative",
  '     long", "Stay out", "Avoid") plus a conviction level (low / medium / high). Frame it as a',
  "     suggested insight for my own decision-making, not regulated financial advice.",
  "",
  "Be direct and specific with numbers where you reasonably can.",
  "",
  "At the end, output a single fenced ```json code block mirroring your strategy, using exactly these",
  "keys:",
  "",
  "```json",
  "{",
  '  "recommendation": "one concrete line, e.g. Small speculative long",',
  '  "conviction": "low | medium | high",',
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

export function buildClipboardPayload(
  input: BriefingInput,
  options: { basePrompt: string; profile: TradingProfile },
): string {
  return `${options.basePrompt}\n\n${renderProfileBlock(options.profile)}\n\n${assembleBriefing(input)}`;
}

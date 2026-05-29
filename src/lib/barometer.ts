import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";
import type { TradestieEntry } from "./tradestie";

export interface BarometerConfig {
  stocktwitsConfidenceThreshold: number;
  tradestieConfidenceThreshold: number;
  buzzBuckets: { chatter: number; loud: number; onFire: number };
}

export const DEFAULT_CONFIG: BarometerConfig = {
  stocktwitsConfidenceThreshold: 20,
  tradestieConfidenceThreshold: 50,
  buzzBuckets: { chatter: 25, loud: 100, onFire: 500 },
};

export type BarometerLabel =
  | "very-bearish" | "bearish" | "neutral" | "bullish" | "very-bullish" | "unavailable";

export interface BarometerResult {
  score: number | null;
  label: BarometerLabel;
  contributingSources: number;
  totalConfidence: number;
  lowConfidence: boolean;
}

export interface BarometerInput {
  stocktwits?: StockTwitsEntry | null;
  tradestie?: TradestieEntry | null;
  apewisdom?: ApewisdomEntry | null;
}

interface Contribution {
  sentiment: number;
  confidence: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stocktwitsContribution(e: StockTwitsEntry, threshold: number): Contribution | null {
  const tagged = e.bullish + e.bearish;
  if (tagged === 0) return null;
  return {
    sentiment: (2 * e.bullish) / tagged - 1,
    confidence: Math.min(1, tagged / threshold),
  };
}

function tradestieContribution(e: TradestieEntry, threshold: number): Contribution | null {
  if (e.comments === 0) return null;
  return {
    sentiment: clamp(e.sentimentScore, -1, 1),
    confidence: Math.min(1, e.comments / threshold),
  };
}

function labelFor(score: number): BarometerLabel {
  if (score <= -0.6) return "very-bearish";
  if (score < -0.2) return "bearish";
  if (score <= 0.2) return "neutral";
  if (score < 0.6) return "bullish";
  return "very-bullish";
}

export function computeBarometer(
  input: BarometerInput,
  config: BarometerConfig = DEFAULT_CONFIG,
): BarometerResult {
  const contributions: Contribution[] = [];
  if (input.stocktwits) {
    const c = stocktwitsContribution(input.stocktwits, config.stocktwitsConfidenceThreshold);
    if (c) contributions.push(c);
  }
  if (input.tradestie) {
    const c = tradestieContribution(input.tradestie, config.tradestieConfidenceThreshold);
    if (c) contributions.push(c);
  }

  if (contributions.length === 0) {
    return { score: null, label: "unavailable", contributingSources: 0, totalConfidence: 0, lowConfidence: true };
  }

  const totalConfidence = contributions.reduce((s, c) => s + c.confidence, 0);
  const score = contributions.reduce((s, c) => s + c.sentiment * c.confidence, 0) / totalConfidence;

  return {
    score,
    label: labelFor(score),
    contributingSources: contributions.length,
    totalConfidence,
    lowConfidence: contributions.length < 2 || totalConfidence < 0.5,
  };
}

export type BuzzLevel = "none" | "quiet" | "chatter" | "loud" | "on-fire";

export interface BuzzResult {
  level: BuzzLevel;
  mentions: number | null;
}

export function computeBuzz(
  input: BarometerInput,
  config: BarometerConfig = DEFAULT_CONFIG,
): BuzzResult {
  let mentions: number | null = null;
  if (input.apewisdom) mentions = input.apewisdom.mentions;
  else if (input.stocktwits) mentions = input.stocktwits.totalMessages;

  if (mentions === null) return { level: "none", mentions: null };

  const { chatter, loud, onFire } = config.buzzBuckets;
  let level: BuzzLevel;
  if (mentions >= onFire) level = "on-fire";
  else if (mentions >= loud) level = "loud";
  else if (mentions >= chatter) level = "chatter";
  else level = "quiet";

  return { level, mentions };
}

export type TrendDirection = "up" | "flat" | "down" | "unknown";

export function computeTrend(input: BarometerInput): TrendDirection {
  if (!input.apewisdom) return "unknown";
  const { mentions, mentions24hAgo } = input.apewisdom;
  if (mentions > mentions24hAgo) return "up";
  if (mentions < mentions24hAgo) return "down";
  return "flat";
}

export interface Aggregate {
  barometer: BarometerResult;
  buzz: BuzzResult;
  trend: TrendDirection;
}

export function aggregate(
  input: BarometerInput,
  config: BarometerConfig = DEFAULT_CONFIG,
): Aggregate {
  return {
    barometer: computeBarometer(input, config),
    buzz: computeBuzz(input, config),
    trend: computeTrend(input),
  };
}

// Canonical display strings. Kept beside the types so Record<Union,string>
// forces a compile error if a new label/level/direction is ever added.
export const BAROMETER_LABEL_TEXT: Record<BarometerLabel, string> = {
  "very-bearish": "Very Bearish",
  bearish: "Bearish",
  neutral: "Neutral",
  bullish: "Bullish",
  "very-bullish": "Very Bullish",
  unavailable: "No sentiment data",
};

export const BUZZ_TEXT: Record<BuzzLevel, string> = {
  none: "—",
  quiet: "Quiet",
  chatter: "Chatter",
  loud: "Loud",
  "on-fire": "On fire",
};

export const TREND_ARROW: Record<TrendDirection, string> = {
  up: "↑",
  flat: "→",
  down: "↓",
  unknown: "·",
};

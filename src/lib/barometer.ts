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

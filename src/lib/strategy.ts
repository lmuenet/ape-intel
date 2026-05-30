import { extractJson } from "./json";

export interface Strategy {
  recommendation?: string;
  conviction?: string;
  direction?: string;
  timeframe?: string;
  targetPrice?: string;
  stopLoss?: string;
  leverage?: string;
  instruments?: string;
  positionSizing?: string;
  barometerCritique?: string;
  rationale?: string;
  risks?: string;
}

export interface StoredStrategy extends Strategy {
  ingestedAt: string; // ISO timestamp
}

const KEYS: (keyof Strategy)[] = [
  "recommendation", "conviction",
  "direction", "timeframe", "targetPrice", "stopLoss", "leverage",
  "instruments", "positionSizing", "barometerCritique", "rationale", "risks",
];

export function parseStrategy(text: string): Strategy | null {
  const json = extractJson(text);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  const strategy: Strategy = {};
  for (const key of KEYS) {
    const v = obj[key];
    if (v !== undefined && v !== null) {
      strategy[key] = typeof v === "string" ? v : String(v);
    }
  }
  return strategy;
}

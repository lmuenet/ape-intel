import { extractJson } from "./json";

export type Verdict = "signal" | "noise" | "watch";

export interface TickerVerdict {
  ticker: string;
  verdict: Verdict;
  thesis?: string;
  watch?: string;
}

export interface TrendingChallenge {
  summary: string;
  verdicts: TickerVerdict[];
}

export interface StoredTrendingChallenge extends TrendingChallenge {
  ingestedAt: string; // ISO timestamp
  tickers: string[]; // trending tickers the challenge was applied against
}

const VERDICTS: ReadonlySet<string> = new Set(["signal", "noise", "watch"]);

function toVerdict(raw: unknown): TickerVerdict | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.ticker !== "string" || obj.ticker.length === 0) return null;
  if (typeof obj.verdict !== "string" || !VERDICTS.has(obj.verdict)) return null;
  const v: TickerVerdict = { ticker: obj.ticker, verdict: obj.verdict as Verdict };
  if (typeof obj.thesis === "string") v.thesis = obj.thesis;
  if (typeof obj.watch === "string") v.watch = obj.watch;
  return v;
}

export function parseTrendingChallenge(text: string): TrendingChallenge | null {
  const json = extractJson(text);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  let summary = "";
  let rawList: unknown;
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.summary === "string") summary = obj.summary;
    rawList = Array.isArray(obj.verdicts) ? obj.verdicts : obj.items;
  } else {
    return null;
  }

  if (!Array.isArray(rawList)) return null;

  const verdicts = rawList
    .map(toVerdict)
    .filter((v): v is TickerVerdict => v !== null);

  return { summary, verdicts };
}

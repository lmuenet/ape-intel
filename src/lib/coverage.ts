import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";

export type Coverage = "covered" | "thin" | "uncovered" | "unknown";

export interface CoverageInput {
  ticker: string | null | undefined;
  apewisdom: ApewisdomEntry | null | undefined;
  stocktwits: StockTwitsEntry | null | undefined;
}

export function classifyCoverage({ ticker, apewisdom, stocktwits }: CoverageInput): Coverage {
  if (ticker === undefined) return "unknown";
  if (ticker === null) return "uncovered";
  if (apewisdom === undefined || stocktwits === undefined) return "unknown";
  const hasChatter =
    (apewisdom !== null && apewisdom.mentions > 0) ||
    (stocktwits !== null && stocktwits.totalMessages > 0);
  return hasChatter ? "covered" : "thin";
}

export const COVERAGE_TEXT: Record<Coverage, string> = {
  covered: "Covered",
  thin: "Thin coverage",
  uncovered: "Uncovered",
  unknown: "",
};

export const COVERAGE_DETAIL: Record<Coverage, string> = {
  covered: "US-listed with active community chatter.",
  thin: "Mapped to a US ticker, but sources are quiet.",
  uncovered: "No US-ticker mapping (ETF or non-US listing) — limited data.",
  unknown: "",
};

import { describe, expect, it } from "vitest";
import type { Aggregate } from "./barometer";
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";
import type { EarningsDate, NewsItem } from "./finnhub";
import { assembleBriefing, buildClipboardPayload, EXPORT_PROMPT, type BriefingInput } from "./briefing";

const aggregate: Aggregate = {
  barometer: { score: 0.7, label: "very-bullish", contributingSources: 1, totalConfidence: 1, lowConfidence: true },
  buzz: { level: "loud", mentions: 247 },
  trend: "up",
};
const apewisdom: ApewisdomEntry = { rank: 5, mentions: 247, mentions24hAgo: 180 };
const stocktwits: StockTwitsEntry = { bullish: 18, bearish: 4, totalMessages: 30 };
const news: NewsItem[] = [
  { headline: "Acme posts record quarter", source: "Reuters", url: "u", datetime: 1747699200, catalyst: "earnings" },
];
const earnings: EarningsDate = { date: "2026-06-02", epsEstimate: 2.15 };

const full = (): BriefingInput => ({
  ticker: "AAPL", aggregate, apewisdom, stocktwits, news, earnings,
});

describe("assembleBriefing", () => {
  it("includes the ticker as the title", () => {
    expect(assembleBriefing(full())).toContain("# Ape Intel Briefing — AAPL");
  });
  it("renders the barometer label, score and low-confidence note", () => {
    const out = assembleBriefing(full());
    expect(out).toContain("Very Bullish (score 0.70)");
    expect(out).toContain("Low confidence (1 source).");
  });
  it("renders buzz, mentions and a worded trend", () => {
    const out = assembleBriefing(full());
    expect(out).toContain("Buzz: Loud (247 mentions)");
    expect(out).toContain("Trend: rising");
  });
  it("renders both community sources", () => {
    const out = assembleBriefing(full());
    expect(out).toContain("StockTwits: 18 bullish / 4 bearish (30 messages)");
    expect(out).toContain("Apewisdom: 247 mentions, rank #5");
  });
  it("renders the next earnings date with EPS", () => {
    expect(assembleBriefing(full())).toContain("Next: 2026-06-02, EPS est. 2.15");
  });
  it("renders news headlines with source, date and catalyst", () => {
    expect(assembleBriefing(full())).toContain("- Acme posts record quarter (Reuters, 2025-05-20) [Earnings]");
  });

  it("shows explicit empty states", () => {
    const out = assembleBriefing({
      ticker: "ZZZ", aggregate: null, apewisdom: null, stocktwits: null, news: [], earnings: null,
    });
    expect(out).toContain("No sentiment data.");
    expect(out).toContain("StockTwits: no data.");
    expect(out).toContain("Apewisdom: no data.");
    expect(out).toContain("No upcoming earnings.");
    expect(out).toContain("No recent news.");
  });

  it("omits the EPS estimate when null", () => {
    const out = assembleBriefing({ ...full(), earnings: { date: "2026-07-01", epsEstimate: null } });
    expect(out).toContain("Next: 2026-07-01");
    expect(out).not.toContain("EPS est.");
  });
});

describe("EXPORT_PROMPT", () => {
  it("asks for a trading strategy on this stock", () => {
    expect(EXPORT_PROMPT.toLowerCase()).toContain("trading strategy");
  });
  it("tells the model to critically challenge our barometer", () => {
    const p = EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("barometer");
    expect(p).toContain("challenge");
  });
  it("asks the model to do its own independent research across many sources", () => {
    const p = EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("research");
    expect(p).toContain("reddit");
    expect(p).toContain("seeking alpha");
    expect(p).toContain("r/stocks");
  });
  it("asks for a concrete recommendation with a conviction level", () => {
    const p = EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("recommendation");
    expect(p).toContain("conviction");
  });
  it("requests concrete strategy parameters", () => {
    const p = EXPORT_PROMPT.toLowerCase();
    expect(p).toContain("long or short");
    expect(p).toContain("timeframe");
    expect(p).toContain("leverage");
    expect(p).toContain("position sizing");
  });
  it("requests a fenced json block mirroring the strategy", () => {
    expect(EXPORT_PROMPT).toContain("```json");
    expect(EXPORT_PROMPT).toContain("recommendation");
    expect(EXPORT_PROMPT).toContain("conviction");
    expect(EXPORT_PROMPT).toContain("direction");
    expect(EXPORT_PROMPT).toContain("targetPrice");
    expect(EXPORT_PROMPT).toContain("leverage");
  });
});

describe("buildClipboardPayload", () => {
  it("is the prompt, a blank line, then the briefing", () => {
    const input = full();
    expect(buildClipboardPayload(input)).toBe(`${EXPORT_PROMPT}\n\n${assembleBriefing(input)}`);
  });
});

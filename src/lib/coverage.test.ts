import { describe, expect, it } from "vitest";
import { classifyCoverage, COVERAGE_TEXT, COVERAGE_DETAIL, type Coverage } from "./coverage";
import type { ApewisdomEntry } from "./apewisdom";
import type { StockTwitsEntry } from "./stocktwits";

const ape = (mentions: number): ApewisdomEntry => ({ rank: 1, mentions, mentions24hAgo: 0 });
const st = (totalMessages: number): StockTwitsEntry => ({ bullish: 0, bearish: 0, totalMessages });

describe("classifyCoverage", () => {
  it("is unknown while the ticker is still resolving", () => {
    expect(classifyCoverage({ ticker: undefined, apewisdom: undefined, stocktwits: undefined })).toBe("unknown");
  });
  it("is uncovered when there is no ticker mapping", () => {
    expect(classifyCoverage({ ticker: null, apewisdom: null, stocktwits: null })).toBe("uncovered");
  });
  it("is unknown when the ticker resolved but a source is still loading", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: undefined, stocktwits: null })).toBe("unknown");
  });
  it("is thin when the ticker resolved but both sources are empty", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: null, stocktwits: null })).toBe("thin");
  });
  it("is thin when sources are present but have zero volume", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: ape(0), stocktwits: st(0) })).toBe("thin");
  });
  it("is covered when apewisdom has mentions", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: ape(12), stocktwits: null })).toBe("covered");
  });
  it("is covered when stocktwits has messages", () => {
    expect(classifyCoverage({ ticker: "AAPL", apewisdom: null, stocktwits: st(5) })).toBe("covered");
  });
  it("exposes label and detail text for every state", () => {
    const states: Coverage[] = ["covered", "thin", "uncovered", "unknown"];
    for (const s of states) {
      expect(typeof COVERAGE_TEXT[s]).toBe("string");
      expect(typeof COVERAGE_DETAIL[s]).toBe("string");
    }
    expect(COVERAGE_TEXT.covered).toBe("Covered");
    expect(COVERAGE_TEXT.thin).toBe("Thin coverage");
    expect(COVERAGE_TEXT.uncovered).toBe("Uncovered");
    expect(COVERAGE_TEXT.unknown).toBe("");
  });
});

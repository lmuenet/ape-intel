import { describe, expect, it } from "vitest";
import { computeBarometer, DEFAULT_CONFIG } from "./barometer";

describe("computeBarometer", () => {
  it("returns unavailable when no sentiment source has data", () => {
    const r = computeBarometer({ apewisdom: { rank: 1, mentions: 100, mentions24hAgo: 50 } });
    expect(r.score).toBeNull();
    expect(r.label).toBe("unavailable");
    expect(r.contributingSources).toBe(0);
    expect(r.lowConfidence).toBe(true);
  });

  it("derives StockTwits sentiment from the bullish/bearish split", () => {
    const r = computeBarometer({ stocktwits: { bullish: 18, bearish: 4, totalMessages: 30 } });
    // 2*18/22 - 1 = 0.636…
    expect(r.score).toBeCloseTo(0.636, 2);
    expect(r.label).toBe("very-bullish");
    expect(r.contributingSources).toBe(1);
  });

  it("ignores a StockTwits entry with no tagged messages", () => {
    const r = computeBarometer({ stocktwits: { bullish: 0, bearish: 0, totalMessages: 12 } });
    expect(r.label).toBe("unavailable");
  });

  it("flags a single source as low confidence even at full volume", () => {
    const r = computeBarometer({ stocktwits: { bullish: 40, bearish: 40, totalMessages: 80 } });
    expect(r.contributingSources).toBe(1);
    expect(r.totalConfidence).toBe(1); // 80/20 capped at 1
    expect(r.lowConfidence).toBe(true);
    expect(r.label).toBe("neutral"); // score 0
  });

  it("confidence-weights two sources and is not low confidence when both are full", () => {
    const r = computeBarometer({
      stocktwits: { bullish: 20, bearish: 0, totalMessages: 20 }, // sentiment +1, conf 1
      tradestie: { comments: 50, sentimentLabel: "Bearish", sentimentScore: -1 }, // sentiment -1, conf 1
    });
    expect(r.score).toBeCloseTo(0, 5); // (+1*1 + -1*1) / 2
    expect(r.contributingSources).toBe(2);
    expect(r.lowConfidence).toBe(false);
  });

  it("clamps Tradestie sentimentScore into [-1, 1]", () => {
    const r = computeBarometer({ tradestie: { comments: 100, sentimentLabel: "Bullish", sentimentScore: 5 } });
    expect(r.score).toBe(1);
  });

  it("exposes tunable default thresholds", () => {
    expect(DEFAULT_CONFIG.stocktwitsConfidenceThreshold).toBe(20);
    expect(DEFAULT_CONFIG.tradestieConfidenceThreshold).toBe(50);
  });
});

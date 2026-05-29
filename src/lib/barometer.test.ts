import { describe, expect, it } from "vitest";
import { computeBarometer, DEFAULT_CONFIG, computeBuzz, computeTrend, aggregate, BAROMETER_LABEL_TEXT, BUZZ_TEXT, TREND_ARROW } from "./barometer";

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

  it("labels bearish and very-bearish scores", () => {
    const bearish = computeBarometer({ stocktwits: { bullish: 6, bearish: 14, totalMessages: 20 } });
    // 2*6/20 - 1 = -0.4 → bearish
    expect(bearish.score).toBeCloseTo(-0.4, 5);
    expect(bearish.label).toBe("bearish");

    const veryBearish = computeBarometer({ stocktwits: { bullish: 2, bearish: 18, totalMessages: 20 } });
    // 2*2/20 - 1 = -0.8 → very-bearish
    expect(veryBearish.score).toBeCloseTo(-0.8, 5);
    expect(veryBearish.label).toBe("very-bearish");
  });

  it("sums confidence across two full sources to 2", () => {
    const r = computeBarometer({
      stocktwits: { bullish: 20, bearish: 0, totalMessages: 20 },
      tradestie: { comments: 50, sentimentLabel: "Bullish", sentimentScore: 1 },
    });
    expect(r.totalConfidence).toBe(2);
    expect(r.score).toBe(1);
  });
});

describe("computeBuzz", () => {
  it("returns none when no volume source is present", () => {
    expect(computeBuzz({})).toEqual({ level: "none", mentions: null });
  });

  it("buckets Apewisdom mentions at the default boundaries", () => {
    const buzz = (mentions: number) =>
      computeBuzz({ apewisdom: { rank: 1, mentions, mentions24hAgo: 0 } }).level;
    expect(buzz(24)).toBe("quiet");
    expect(buzz(25)).toBe("chatter");
    expect(buzz(99)).toBe("chatter");
    expect(buzz(100)).toBe("loud");
    expect(buzz(499)).toBe("loud");
    expect(buzz(500)).toBe("on-fire");
  });

  it("falls back to StockTwits message count when Apewisdom is absent", () => {
    const r = computeBuzz({ stocktwits: { bullish: 1, bearish: 1, totalMessages: 30 } });
    expect(r).toEqual({ level: "chatter", mentions: 30 });
  });

  it("prefers Apewisdom mentions over StockTwits when both are present", () => {
    const r = computeBuzz({
      apewisdom: { rank: 1, mentions: 600, mentions24hAgo: 0 },
      stocktwits: { bullish: 1, bearish: 1, totalMessages: 10 },
    });
    expect(r).toEqual({ level: "on-fire", mentions: 600 });
  });
});

describe("computeTrend", () => {
  it("is unknown without Apewisdom", () => {
    expect(computeTrend({ stocktwits: { bullish: 1, bearish: 1, totalMessages: 2 } })).toBe("unknown");
  });

  it("reads direction from mentions vs mentions24hAgo", () => {
    expect(computeTrend({ apewisdom: { rank: 1, mentions: 100, mentions24hAgo: 50 } })).toBe("up");
    expect(computeTrend({ apewisdom: { rank: 1, mentions: 50, mentions24hAgo: 100 } })).toBe("down");
    expect(computeTrend({ apewisdom: { rank: 1, mentions: 80, mentions24hAgo: 80 } })).toBe("flat");
  });
});

describe("aggregate", () => {
  it("bundles barometer, buzz, and trend", () => {
    const r = aggregate({
      stocktwits: { bullish: 18, bearish: 4, totalMessages: 30 },
      apewisdom: { rank: 5, mentions: 247, mentions24hAgo: 180 },
    });
    expect(r.barometer.label).toBe("very-bullish");
    expect(r.buzz.level).toBe("loud");
    expect(r.trend).toBe("up");
  });
});

describe("display maps", () => {
  it("has human text for every barometer label", () => {
    expect(BAROMETER_LABEL_TEXT.unavailable).toMatch(/no sentiment/i);
    expect(BAROMETER_LABEL_TEXT["very-bullish"]).toBe("Very Bullish");
    expect(BAROMETER_LABEL_TEXT["very-bearish"]).toBe("Very Bearish");
    expect(BAROMETER_LABEL_TEXT.bearish).toBe("Bearish");
    expect(BAROMETER_LABEL_TEXT.neutral).toBe("Neutral");
    expect(BAROMETER_LABEL_TEXT.bullish).toBe("Bullish");
  });
  it("maps trend directions to arrows", () => {
    expect(TREND_ARROW.up).toBe("↑");
    expect(TREND_ARROW.down).toBe("↓");
    expect(TREND_ARROW.flat).toBe("→");
    expect(TREND_ARROW.unknown).toBe("·");
  });
  it("maps buzz levels to text", () => {
    expect(BUZZ_TEXT["on-fire"]).toMatch(/fire/i);
    expect(BUZZ_TEXT.none).toBe("—");
  });
});

import { describe, expect, it } from "vitest";
import {
  assembleTrendingBriefing,
  buildTrendingClipboardPayload,
  TRENDING_EXPORT_PROMPT,
} from "./trending-briefing";
import type { TrendingRow } from "../background/apewisdom-service";

const rows: TrendingRow[] = [
  { ticker: "TSLA", name: "Tesla", rank: 1, mentions: 99, mentions24hAgo: 50 },
  { ticker: "GME", name: "GameStop", rank: 2, mentions: 10, mentions24hAgo: 40 },
  { ticker: "NVDA", rank: 3, mentions: 80, mentions24hAgo: 80 },
];

describe("assembleTrendingBriefing", () => {
  it("lists each candidate with ticker, name, mentions and a trend word", () => {
    const md = assembleTrendingBriefing(rows);
    expect(md).toContain("TSLA");
    expect(md).toContain("Tesla");
    expect(md).toContain("99");
    expect(md).toMatch(/rising/i);
    expect(md).toMatch(/falling/i);
    expect(md).toMatch(/flat/i);
  });

  it("falls back to the ticker when a row has no name", () => {
    expect(assembleTrendingBriefing([rows[2]])).toContain("NVDA");
  });
});

describe("buildTrendingClipboardPayload", () => {
  it("prepends the export prompt to the briefing", () => {
    const payload = buildTrendingClipboardPayload(rows);
    expect(payload.startsWith(TRENDING_EXPORT_PROMPT)).toBe(true);
    expect(payload).toContain("TSLA");
  });

  it("asks for the verdict json schema", () => {
    expect(TRENDING_EXPORT_PROMPT).toMatch(/signal/);
    expect(TRENDING_EXPORT_PROMPT).toMatch(/noise/);
    expect(TRENDING_EXPORT_PROMPT).toMatch(/watch/);
    expect(TRENDING_EXPORT_PROMPT.toLowerCase()).toContain("json");
  });
});

import { describe, expect, it } from "vitest";
import { parseTrendingChallenge } from "./trending-challenge";

describe("parseTrendingChallenge", () => {
  it("parses the object form { summary, verdicts }", () => {
    const text = `\`\`\`json
{
  "summary": "Two real plays, one dud.",
  "verdicts": [
    { "ticker": "TSLA", "verdict": "signal", "thesis": "delivery beat", "watch": "earnings" },
    { "ticker": "GME", "verdict": "noise", "thesis": "meme pump" }
  ]
}
\`\`\``;
    expect(parseTrendingChallenge(text)).toEqual({
      summary: "Two real plays, one dud.",
      verdicts: [
        { ticker: "TSLA", verdict: "signal", thesis: "delivery beat", watch: "earnings" },
        { ticker: "GME", verdict: "noise", thesis: "meme pump" },
      ],
    });
  });

  it("accepts a bare top-level array (summary defaults to empty)", () => {
    const text = '[{"ticker":"NVDA","verdict":"watch","thesis":"AI demand"}]';
    expect(parseTrendingChallenge(text)).toEqual({
      summary: "",
      verdicts: [{ ticker: "NVDA", verdict: "watch", thesis: "AI demand" }],
    });
  });

  it("accepts an `items` array as an alias for verdicts", () => {
    const text = '{"summary":"s","items":[{"ticker":"X","verdict":"signal"}]}';
    expect(parseTrendingChallenge(text)).toEqual({
      summary: "s",
      verdicts: [{ ticker: "X", verdict: "signal" }],
    });
  });

  it("drops entries with an unknown verdict or missing ticker", () => {
    const text =
      '[{"ticker":"A","verdict":"signal"},{"ticker":"B","verdict":"bogus"},{"verdict":"noise"}]';
    expect(parseTrendingChallenge(text)?.verdicts).toEqual([
      { ticker: "A", verdict: "signal" },
    ]);
  });

  it("returns null when no JSON is present", () => {
    expect(parseTrendingChallenge("no json at all")).toBeNull();
  });

  it("returns null when JSON is malformed", () => {
    expect(parseTrendingChallenge("{ this is not json }")).toBeNull();
  });
});

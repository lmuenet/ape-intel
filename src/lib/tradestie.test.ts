import { describe, expect, it, vi } from "vitest";
import { fetchTradestieSnapshot } from "./tradestie";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

describe("fetchTradestieSnapshot", () => {
  it("requests the reddit endpoint and maps entries by ticker", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      ok([
        { ticker: "TSLA", no_of_comments: 320, sentiment: "Bullish", sentiment_score: 0.71 },
        { ticker: "AAPL", no_of_comments: 110, sentiment: "Neutral", sentiment_score: 0.5 },
      ]),
    );

    const map = await fetchTradestieSnapshot(fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.tradestie.com/v1/apps/reddit",
    );
    expect(map.get("TSLA")).toEqual({
      comments: 320,
      sentimentLabel: "Bullish",
      sentimentScore: 0.71,
    });
    expect(map.get("AAPL")?.sentimentLabel).toBe("Neutral");
    expect(map.size).toBe(2);
  });

  it("returns an empty map when no results", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok([]));
    expect((await fetchTradestieSnapshot(fetchFn)).size).toBe(0);
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    await expect(fetchTradestieSnapshot(fetchFn)).rejects.toThrow(/503/);
  });
});

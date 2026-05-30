import { describe, expect, it, vi } from "vitest";
import { fetchApewisdomSnapshot } from "./apewisdom";

const okPage = (results: Array<Record<string, unknown>>): Response =>
  new Response(JSON.stringify({ results }), { status: 200 });

const entry = (ticker: string, rank: number) => ({
  rank,
  ticker,
  name: ticker,
  mentions: 100 - rank,
  upvotes: 1,
  rank_24h_ago: rank + 1,
  mentions_24h_ago: 90 - rank,
});

describe("fetchApewisdomSnapshot", () => {
  it("requests pages 1..N and merges into a single map keyed by ticker", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(okPage([entry("TSLA", 1), entry("AAPL", 2)]))
      .mockResolvedValueOnce(okPage([entry("NVDA", 51)]));

    const map = await fetchApewisdomSnapshot(fetchFn, 2);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "https://apewisdom.io/api/v1.0/filter/all-stocks/page/1",
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "https://apewisdom.io/api/v1.0/filter/all-stocks/page/2",
    );
    expect(map.get("TSLA")).toEqual({
      rank: 1,
      name: "TSLA",
      mentions: 99,
      mentions24hAgo: 89,
    });
    expect(map.get("NVDA")).toEqual({
      rank: 51,
      name: "NVDA",
      mentions: 49,
      mentions24hAgo: 39,
    });
    expect(map.size).toBe(3);
  });

  it("leaves name undefined when the raw entry omits it", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        okPage([{ rank: 1, ticker: "GME", mentions: 10, mentions_24h_ago: 5 }]),
      );

    const map = await fetchApewisdomSnapshot(fetchFn, 1);

    expect(map.get("GME")).toEqual({
      rank: 1,
      name: undefined,
      mentions: 10,
      mentions24hAgo: 5,
    });
  });

  it("defaults to 5 pages when no count is given", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => okPage([]));
    await fetchApewisdomSnapshot(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it("throws on non-2xx response", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(
        async () => new Response("rate limited", { status: 429 }),
      );
    await expect(fetchApewisdomSnapshot(fetchFn, 1)).rejects.toThrow(/429/);
  });

  it("returns an empty map when all pages have zero results", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => okPage([]));
    const map = await fetchApewisdomSnapshot(fetchFn, 3);
    expect(map.size).toBe(0);
  });
});

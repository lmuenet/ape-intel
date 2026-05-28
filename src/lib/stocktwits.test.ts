import { describe, expect, it, vi } from "vitest";
import { fetchStockTwitsForTicker } from "./stocktwits";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

const message = (basic: "Bullish" | "Bearish" | null) => ({
  entities: { sentiment: basic ? { basic } : null },
});

describe("fetchStockTwitsForTicker", () => {
  it("requests the per-symbol stream endpoint", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ messages: [] }));
    await fetchStockTwitsForTicker("AAPL", fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.stocktwits.com/api/2/streams/symbol/AAPL.json",
    );
  });

  it("counts bullish, bearish, and total messages", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      ok({
        messages: [
          message("Bullish"),
          message("Bullish"),
          message("Bearish"),
          message(null),
        ],
      }),
    );
    expect(await fetchStockTwitsForTicker("AAPL", fetchFn)).toEqual({
      bullish: 2,
      bearish: 1,
      totalMessages: 4,
    });
  });

  it("returns null when the response carries an errors array", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      ok({ errors: [{ message: "Symbol not found." }] }),
    );
    expect(await fetchStockTwitsForTicker("XYZZY", fetchFn)).toBeNull();
  });

  it("returns null when messages array is missing", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({}));
    expect(await fetchStockTwitsForTicker("AAPL", fetchFn)).toBeNull();
  });

  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("rate", { status: 429 }));
    await expect(fetchStockTwitsForTicker("AAPL", fetchFn)).rejects.toThrow(/429/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { TradestieEntry } from "../lib/tradestie";
import { createTradestieService } from "./tradestie-service";

const entry = (label: TradestieEntry["sentimentLabel"]): TradestieEntry => ({
  comments: 100,
  sentimentLabel: label,
  sentimentScore: 0.7,
});

describe("createTradestieService", () => {
  it("returns the entry for a ticker present in the snapshot", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Map([["AAPL", entry("Bullish")]]));
    const service = createTradestieService(createInMemoryKvStore(), fetcher);
    expect(await service.lookup("AAPL")).toEqual(entry("Bullish"));
  });

  it("returns null for a ticker absent from the snapshot", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Map([["TSLA", entry("Bullish")]]));
    const service = createTradestieService(createInMemoryKvStore(), fetcher);
    expect(await service.lookup("NOPE")).toBeNull();
  });

  it("fetches at most once within the ttl window", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Map([["AAPL", entry("Bullish")], ["TSLA", entry("Bearish")]]));
    const service = createTradestieService(createInMemoryKvStore(), fetcher);
    await service.lookup("AAPL");
    await service.lookup("TSLA");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

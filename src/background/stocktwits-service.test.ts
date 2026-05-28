import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { createStockTwitsService } from "./stocktwits-service";

const entry = (b: number, r: number): StockTwitsEntry => ({
  bullish: b,
  bearish: r,
  totalMessages: b + r,
});

describe("createStockTwitsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); });

  it("fetches once per ticker within the ttl", async () => {
    const fetcher = vi.fn().mockResolvedValue(entry(8, 2));
    const service = createStockTwitsService(createInMemoryKvStore(), fetcher);

    expect(await service.lookup("AAPL")).toEqual(entry(8, 2));
    expect(await service.lookup("AAPL")).toEqual(entry(8, 2));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fetches separately per ticker", async () => {
    const fetcher = vi.fn(async (t: string) =>
      t === "AAPL" ? entry(8, 2) : entry(3, 5),
    );
    const service = createStockTwitsService(createInMemoryKvStore(), fetcher);

    expect(await service.lookup("AAPL")).toEqual(entry(8, 2));
    expect(await service.lookup("TSLA")).toEqual(entry(3, 5));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns null and caches null", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const service = createStockTwitsService(createInMemoryKvStore(), fetcher);

    expect(await service.lookup("XYZZY")).toBeNull();
    expect(await service.lookup("XYZZY")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

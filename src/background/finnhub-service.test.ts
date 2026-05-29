import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { NewsItem } from "../lib/finnhub";
import { createFinnhubService } from "./finnhub-service";

const newsItem = (url: string): NewsItem => ({
  headline: "h", source: "s", url, datetime: 1, catalyst: "news",
});

describe("createFinnhubService", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns null without calling fetchers when no api key is stored", async () => {
    const newsFetcher = vi.fn();
    const earningsFetcher = vi.fn();
    const service = createFinnhubService(createInMemoryKvStore(), newsFetcher, earningsFetcher);
    expect(await service.news("AAPL")).toBeNull();
    expect(await service.earnings("AAPL")).toBeNull();
    expect(newsFetcher).not.toHaveBeenCalled();
    expect(earningsFetcher).not.toHaveBeenCalled();
  });

  it("passes the stored key to the news fetcher and caches within ttl", async () => {
    const store = createInMemoryKvStore({ "finnhub:apiKey": "KEY" });
    const newsFetcher = vi.fn(async () => [newsItem("u1")]);
    const service = createFinnhubService(store, newsFetcher, vi.fn());
    expect(await service.news("AAPL")).toEqual([newsItem("u1")]);
    await service.news("AAPL");
    expect(newsFetcher).toHaveBeenCalledTimes(1);
    expect(newsFetcher).toHaveBeenCalledWith("AAPL", "KEY");
  });

  it("caches earnings separately per ticker", async () => {
    const store = createInMemoryKvStore({ "finnhub:apiKey": "KEY" });
    const earningsFetcher = vi.fn(async () => ({ date: "2026-02-01", epsEstimate: 1 }));
    const service = createFinnhubService(store, vi.fn(), earningsFetcher);
    await service.earnings("AAPL");
    await service.earnings("TSLA");
    expect(earningsFetcher).toHaveBeenCalledTimes(2);
  });
});

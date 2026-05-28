import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "./kv-store";
import { createTickerCache } from "./ticker-cache";

describe("createTickerCache", () => {
  it("calls the fetcher and returns the ticker on cache miss", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("AAPL");
    const cache = createTickerCache(store, fetcher);

    expect(await cache.get("US0378331005")).toBe("AAPL");
    expect(fetcher).toHaveBeenCalledWith("US0378331005");
  });

  it("persists the resolved ticker under ticker:<isin>", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("AAPL");
    const cache = createTickerCache(store, fetcher);
    await cache.get("US0378331005");

    expect(await store.get("ticker:US0378331005")).toBe("AAPL");
  });

  it("returns the cached ticker without calling the fetcher again", async () => {
    const store = createInMemoryKvStore({ "ticker:US0378331005": "AAPL" });
    const fetcher = vi.fn();
    const cache = createTickerCache(store, fetcher);

    expect(await cache.get("US0378331005")).toBe("AAPL");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caches a null result and returns it without re-fetching", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue(null);
    const cache = createTickerCache(store, fetcher);

    expect(await cache.get("DE0007164600")).toBeNull();
    expect(await cache.get("DE0007164600")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not persist when the fetcher throws", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const cache = createTickerCache(store, fetcher);

    await expect(cache.get("US0378331005")).rejects.toThrow("network down");
    expect(await store.get("ticker:US0378331005")).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "./kv-store";
import { createTtlCache } from "./ttl-cache";

const TTL = 1000;

describe("createTtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the fetcher on miss and persists with the current timestamp", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("hello");
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    expect(await cache.get("a")).toBe("hello");
    expect(fetcher).toHaveBeenCalledWith("a");
    expect(await store.get("p:a")).toEqual({
      value: "hello",
      fetchedAt: Date.now(),
    });
  });

  it("returns the cached value within the ttl without refetching", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue("hello");
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    await cache.get("a");
    vi.advanceTimersByTime(TTL - 1);
    expect(await cache.get("a")).toBe("hello");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches once the ttl has elapsed", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    await cache.get("a");
    vi.advanceTimersByTime(TTL + 1);
    expect(await cache.get("a")).toBe("second");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches null values just like real ones", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockResolvedValue(null);
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("a")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not persist when the fetcher throws", async () => {
    const store = createInMemoryKvStore();
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const cache = createTtlCache(store, fetcher, { ttlMs: TTL, keyPrefix: "p" });

    await expect(cache.get("a")).rejects.toThrow("boom");
    expect(await store.get("p:a")).toBeUndefined();
  });
});

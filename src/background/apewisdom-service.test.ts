import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { createApewisdomService } from "./apewisdom-service";

const entry = (rank: number): ApewisdomEntry => ({
  rank,
  mentions: 100,
  mentions24hAgo: 80,
  sentimentScore: 60,
});

describe("createApewisdomService", () => {
  it("returns the entry for a ticker present in the snapshot", async () => {
    const store = createInMemoryKvStore();
    const snapshot = new Map([["AAPL", entry(5)]]);
    const fetcher = vi.fn().mockResolvedValue(snapshot);
    const service = createApewisdomService(store, fetcher);

    expect(await service.lookup("AAPL")).toEqual(entry(5));
  });

  it("returns null for a ticker absent from the snapshot", async () => {
    const store = createInMemoryKvStore();
    const snapshot = new Map([["TSLA", entry(1)]]);
    const fetcher = vi.fn().mockResolvedValue(snapshot);
    const service = createApewisdomService(store, fetcher);

    expect(await service.lookup("NOPE")).toBeNull();
  });

  it("fetches the snapshot at most once within the ttl window", async () => {
    const store = createInMemoryKvStore();
    const snapshot = new Map([["AAPL", entry(5)], ["TSLA", entry(1)]]);
    const fetcher = vi.fn().mockResolvedValue(snapshot);
    const service = createApewisdomService(store, fetcher);

    await service.lookup("AAPL");
    await service.lookup("TSLA");
    await service.lookup("NOPE");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

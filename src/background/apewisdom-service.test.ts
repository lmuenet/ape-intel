import { describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { ApewisdomEntry } from "../lib/apewisdom";
import { createApewisdomService } from "./apewisdom-service";

const entry = (rank: number): ApewisdomEntry => ({
  rank,
  mentions: 100,
  mentions24hAgo: 80,
});

const named = (rank: number, name: string): ApewisdomEntry => ({
  rank,
  name,
  mentions: 100 - rank,
  mentions24hAgo: 90 - rank,
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

  describe("board", () => {
    it("returns rows sorted by rank ascending, with the ticker attached", async () => {
      const store = createInMemoryKvStore();
      const snapshot = new Map([
        ["AAPL", named(3, "Apple")],
        ["TSLA", named(1, "Tesla")],
        ["NVDA", named(2, "Nvidia")],
      ]);
      const service = createApewisdomService(store, vi.fn().mockResolvedValue(snapshot));

      expect(await service.board()).toEqual([
        { ticker: "TSLA", name: "Tesla", rank: 1, mentions: 99, mentions24hAgo: 89 },
        { ticker: "NVDA", name: "Nvidia", rank: 2, mentions: 98, mentions24hAgo: 88 },
        { ticker: "AAPL", name: "Apple", rank: 3, mentions: 97, mentions24hAgo: 87 },
      ]);
    });

    it("caps the result at the given limit", async () => {
      const store = createInMemoryKvStore();
      const snapshot = new Map(
        Array.from({ length: 30 }, (_, i) => [`T${i}`, named(i + 1, `N${i}`)] as const),
      );
      const service = createApewisdomService(store, vi.fn().mockResolvedValue(snapshot));

      const rows = await service.board(15);
      expect(rows).toHaveLength(15);
      expect(rows[0].rank).toBe(1);
      expect(rows[14].rank).toBe(15);
    });

    it("defaults to a limit of 15", async () => {
      const store = createInMemoryKvStore();
      const snapshot = new Map(
        Array.from({ length: 20 }, (_, i) => [`T${i}`, named(i + 1, `N${i}`)] as const),
      );
      const service = createApewisdomService(store, vi.fn().mockResolvedValue(snapshot));

      expect(await service.board()).toHaveLength(15);
    });
  });
});

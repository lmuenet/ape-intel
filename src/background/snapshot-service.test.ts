import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { Favourite } from "../lib/favourites";
import type { ApewisdomSnapshot } from "../lib/apewisdom";
import { createSnapshotService } from "./snapshot-service";

const fav = (isin: string, ticker: string): Favourite => ({ isin, ticker });
const NOW = Date.parse("2026-05-30T08:00:00Z"); // utcDay = 2026-05-30

const snapshot = (): ApewisdomSnapshot =>
  new Map([["AAA", { rank: 3, mentions: 100, mentions24hAgo: 80 }]]);

describe("createSnapshotService", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does not fetch when a snapshot already ran today", async () => {
    const store = createInMemoryKvStore({ "snapshot:lastDate": "2026-05-30" });
    const fetchSnapshot = vi.fn(async () => snapshot());
    const service = createSnapshotService(store, async () => [fav("US1", "AAA")], fetchSnapshot);
    await service.runIfDue(NOW);
    expect(fetchSnapshot).not.toHaveBeenCalled();
  });

  it("does not fetch and does not advance the date when there are no favourites", async () => {
    const store = createInMemoryKvStore();
    const fetchSnapshot = vi.fn(async () => snapshot());
    const service = createSnapshotService(store, async () => [], fetchSnapshot);
    await service.runIfDue(NOW);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(await store.get("snapshot:lastDate")).toBeUndefined();
  });

  it("fetches once, records every favourite, and advances lastDate", async () => {
    const store = createInMemoryKvStore();
    const fetchSnapshot = vi.fn(async () => snapshot());
    const service = createSnapshotService(
      store,
      async () => [fav("US1", "AAA"), fav("US2", "ZZZ")],
      fetchSnapshot,
    );
    await service.runIfDue(NOW);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(await service.history("US1")).toEqual([{ date: "2026-05-30", mentions: 100, rank: 3 }]);
    expect(await service.history("US2")).toEqual([{ date: "2026-05-30", mentions: 0, rank: null }]);
    expect(await store.get("snapshot:lastDate")).toBe("2026-05-30");
  });

  it("history returns an empty array for an unknown asset", async () => {
    const service = createSnapshotService(createInMemoryKvStore(), async () => [], vi.fn());
    expect(await service.history("US9")).toEqual([]);
  });
});

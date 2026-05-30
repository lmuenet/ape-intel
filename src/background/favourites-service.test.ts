import { describe, expect, it } from "vitest";
import { createInMemoryKvStore } from "../lib/kv-store";
import type { Favourite } from "../lib/favourites";
import { createFavouritesService } from "./favourites-service";

const fav = (isin: string, ticker = isin): Favourite => ({ isin, ticker });

describe("createFavouritesService", () => {
  it("returns an empty list when nothing is stored", async () => {
    const service = createFavouritesService(createInMemoryKvStore());
    expect(await service.get()).toEqual([]);
  });

  it("toggle adds and persists, returning the new membership", async () => {
    const store = createInMemoryKvStore();
    const service = createFavouritesService(store);
    expect(await service.toggle(fav("US1", "AAA"))).toBe(true);
    expect(await service.get()).toEqual([fav("US1", "AAA")]);
    expect(await service.has("US1")).toBe(true);
  });

  it("toggle removes and deletes that asset's snapshot history", async () => {
    const store = createInMemoryKvStore({
      favourites: [fav("US1")],
      "snapshot:history:US1": [{ date: "2026-05-30", mentions: 5, rank: 1 }],
    });
    const service = createFavouritesService(store);
    expect(await service.toggle(fav("US1"))).toBe(false);
    expect(await service.get()).toEqual([]);
    expect(await store.get("snapshot:history:US1")).toBeUndefined();
  });
});

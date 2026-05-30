import { describe, expect, it } from "vitest";
import { hasFavourite, toggleFavourite, FAVOURITES_CAP, type Favourite } from "./favourites";

const fav = (isin: string, ticker = isin): Favourite => ({ isin, ticker });

describe("hasFavourite", () => {
  it("is true when the isin is present", () => {
    expect(hasFavourite([fav("US1")], "US1")).toBe(true);
  });
  it("is false when absent", () => {
    expect(hasFavourite([fav("US1")], "US2")).toBe(false);
  });
});

describe("toggleFavourite", () => {
  it("adds when absent", () => {
    expect(toggleFavourite([], fav("US1", "AAA"))).toEqual([fav("US1", "AAA")]);
  });
  it("removes when present", () => {
    expect(toggleFavourite([fav("US1"), fav("US2")], fav("US1"))).toEqual([fav("US2")]);
  });
  it("is a no-op add at the cap", () => {
    const full = [fav("A"), fav("B")];
    expect(toggleFavourite(full, fav("C"), 2)).toEqual(full);
  });
  it("still removes at the cap", () => {
    const full = [fav("A"), fav("B")];
    expect(toggleFavourite(full, fav("A"), 2)).toEqual([fav("B")]);
  });
  it("exposes a default cap of 20", () => {
    expect(FAVOURITES_CAP).toBe(20);
  });
});

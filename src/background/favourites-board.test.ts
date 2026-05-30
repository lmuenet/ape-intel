import { describe, expect, it, vi } from "vitest";
import type { ApewisdomEntry } from "../lib/apewisdom";
import type { DailySnapshot } from "../lib/snapshot-history";
import { buildFavouritesBoard } from "./favourites-board";

const standing = (rank: number): ApewisdomEntry => ({
  rank,
  name: `N${rank}`,
  mentions: 100,
  mentions24hAgo: 80,
});

const history = (date: string): DailySnapshot => ({ date, mentions: 5, rank: 1 });

describe("buildFavouritesBoard", () => {
  it("composes each favourite with its current standing and history", async () => {
    const rows = await buildFavouritesBoard({
      getFavourites: vi.fn().mockResolvedValue([
        { isin: "US1", ticker: "AAPL" },
        { isin: "US2", ticker: "TSLA" },
      ]),
      lookupApewisdom: vi.fn(async (ticker: string) =>
        ticker === "AAPL" ? standing(5) : null,
      ),
      getHistory: vi.fn(async (isin: string) =>
        isin === "US1" ? [history("2026-05-29"), history("2026-05-30")] : [],
      ),
    });

    expect(rows).toEqual([
      {
        isin: "US1",
        ticker: "AAPL",
        standing: standing(5),
        history: [history("2026-05-29"), history("2026-05-30")],
      },
      { isin: "US2", ticker: "TSLA", standing: null, history: [] },
    ]);
  });

  it("returns an empty array when there are no favourites", async () => {
    const rows = await buildFavouritesBoard({
      getFavourites: vi.fn().mockResolvedValue([]),
      lookupApewisdom: vi.fn(),
      getHistory: vi.fn(),
    });
    expect(rows).toEqual([]);
  });

  it("preserves favourites order", async () => {
    const rows = await buildFavouritesBoard({
      getFavourites: vi.fn().mockResolvedValue([
        { isin: "US2", ticker: "TSLA" },
        { isin: "US1", ticker: "AAPL" },
      ]),
      lookupApewisdom: vi.fn().mockResolvedValue(null),
      getHistory: vi.fn().mockResolvedValue([]),
    });
    expect(rows.map((r) => r.ticker)).toEqual(["TSLA", "AAPL"]);
  });
});

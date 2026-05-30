import type { ApewisdomEntry } from "../lib/apewisdom";
import type { Favourite } from "../lib/favourites";
import type { DailySnapshot } from "../lib/snapshot-history";

/** One row of the Favourites companion view: a pinned Asset with its current
 *  Apewisdom standing (null when it isn't trending) and its 7-day history. */
export interface FavouriteRow {
  isin: string;
  ticker: string;
  standing: ApewisdomEntry | null;
  history: DailySnapshot[];
}

export interface FavouritesBoardDeps {
  getFavourites: () => Promise<Favourite[]>;
  lookupApewisdom: (ticker: string) => Promise<ApewisdomEntry | null>;
  getHistory: (isin: string) => Promise<DailySnapshot[]>;
}

export async function buildFavouritesBoard(
  deps: FavouritesBoardDeps,
): Promise<FavouriteRow[]> {
  const favourites = await deps.getFavourites();
  return Promise.all(
    favourites.map(async (fav) => {
      const [standing, history] = await Promise.all([
        deps.lookupApewisdom(fav.ticker),
        deps.getHistory(fav.isin),
      ]);
      return { isin: fav.isin, ticker: fav.ticker, standing, history };
    }),
  );
}

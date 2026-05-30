import type { KvStore } from "../lib/kv-store";
import { hasFavourite, toggleFavourite, type Favourite } from "../lib/favourites";

const FAVOURITES_KEY = "favourites";
const HISTORY_PREFIX = "snapshot:history:";

export interface FavouritesService {
  get(): Promise<Favourite[]>;
  has(isin: string): Promise<boolean>;
  toggle(fav: Favourite): Promise<boolean>;
}

export function createFavouritesService(store: KvStore): FavouritesService {
  async function get(): Promise<Favourite[]> {
    return (await store.get<Favourite[]>(FAVOURITES_KEY)) ?? [];
  }

  return {
    get,
    async has(isin: string): Promise<boolean> {
      return hasFavourite(await get(), isin);
    },
    async toggle(fav: Favourite): Promise<boolean> {
      const list = await get();
      const wasFavourite = hasFavourite(list, fav.isin);
      const next = toggleFavourite(list, fav);
      await store.set(FAVOURITES_KEY, next);
      const nowFavourite = hasFavourite(next, fav.isin);
      if (wasFavourite && !nowFavourite) {
        await store.remove(`${HISTORY_PREFIX}${fav.isin}`);
      }
      return nowFavourite;
    },
  };
}

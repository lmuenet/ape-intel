export interface Favourite {
  isin: string;
  ticker: string;
}

export const FAVOURITES_CAP = 20;

export function hasFavourite(list: Favourite[], isin: string): boolean {
  return list.some((f) => f.isin === isin);
}

export function toggleFavourite(
  list: Favourite[],
  fav: Favourite,
  cap: number = FAVOURITES_CAP,
): Favourite[] {
  if (hasFavourite(list, fav.isin)) {
    return list.filter((f) => f.isin !== fav.isin);
  }
  if (list.length >= cap) return list;
  return [...list, fav];
}

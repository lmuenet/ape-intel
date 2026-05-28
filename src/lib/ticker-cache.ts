import type { KvStore } from "./kv-store";

export type TickerFetcher = (isin: string) => Promise<string | null>;

export interface TickerCache {
  get(isin: string): Promise<string | null>;
}

const keyOf = (isin: string): string => `ticker:${isin}`;

export function createTickerCache(
  store: KvStore,
  fetcher: TickerFetcher,
): TickerCache {
  return {
    async get(isin: string): Promise<string | null> {
      const cached = await store.get<string | null>(keyOf(isin));
      if (cached !== undefined) return cached;

      const fresh = await fetcher(isin);
      await store.set(keyOf(isin), fresh);
      return fresh;
    },
  };
}

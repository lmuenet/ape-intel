import type { KvStore } from "../lib/kv-store";
import type { StockTwitsEntry } from "../lib/stocktwits";
import { createTtlCache } from "../lib/ttl-cache";

const TTL_MS = 15 * 60 * 1000;

export type StockTwitsFetcher = (ticker: string) => Promise<StockTwitsEntry | null>;

export interface StockTwitsService {
  lookup(ticker: string, force?: boolean): Promise<StockTwitsEntry | null>;
}

export function createStockTwitsService(
  store: KvStore,
  fetcher: StockTwitsFetcher,
): StockTwitsService {
  const cache = createTtlCache<StockTwitsEntry | null>(store, fetcher, {
    ttlMs: TTL_MS,
    keyPrefix: "stocktwits",
  });

  return {
    lookup(ticker: string, force?: boolean): Promise<StockTwitsEntry | null> {
      return cache.get(ticker, { force });
    },
  };
}

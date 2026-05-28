import type { KvStore } from "../lib/kv-store";
import type { TradestieEntry, TradestieSnapshot } from "../lib/tradestie";
import { createTtlCache } from "../lib/ttl-cache";

const SNAPSHOT_KEY = "snapshot";
const TTL_MS = 15 * 60 * 1000;

export type TradestieFetcher = () => Promise<TradestieSnapshot>;

export interface TradestieService {
  lookup(ticker: string): Promise<TradestieEntry | null>;
}

interface SerialisedSnapshot {
  entries: Array<[string, TradestieEntry]>;
}

export function createTradestieService(
  store: KvStore,
  fetcher: TradestieFetcher,
): TradestieService {
  const cache = createTtlCache<SerialisedSnapshot>(
    store,
    async () => ({ entries: Array.from((await fetcher()).entries()) }),
    { ttlMs: TTL_MS, keyPrefix: "tradestie" },
  );

  return {
    async lookup(ticker: string): Promise<TradestieEntry | null> {
      const serialised = await cache.get(SNAPSHOT_KEY);
      return new Map(serialised.entries).get(ticker) ?? null;
    },
  };
}

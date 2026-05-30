import type { KvStore } from "../lib/kv-store";
import type { ApewisdomEntry, ApewisdomSnapshot } from "../lib/apewisdom";
import { createTtlCache } from "../lib/ttl-cache";

const SNAPSHOT_KEY = "snapshot";
const TTL_MS = 15 * 60 * 1000; // 15 minutes per PRD

export type ApewisdomFetcher = () => Promise<ApewisdomSnapshot>;

/** One row of the market-wide Trending list: an ApewisdomEntry with its ticker. */
export interface TrendingRow {
  ticker: string;
  name?: string;
  rank: number;
  mentions: number;
  mentions24hAgo: number;
}

const DEFAULT_BOARD_LIMIT = 15;

export interface ApewisdomService {
  lookup(ticker: string): Promise<ApewisdomEntry | null>;
  board(limit?: number): Promise<TrendingRow[]>;
}

interface SerialisedSnapshot {
  entries: Array<[string, ApewisdomEntry]>;
}

export function createApewisdomService(
  store: KvStore,
  fetcher: ApewisdomFetcher,
): ApewisdomService {
  const cache = createTtlCache<SerialisedSnapshot>(
    store,
    async () => ({ entries: Array.from((await fetcher()).entries()) }),
    { ttlMs: TTL_MS, keyPrefix: "apewisdom" },
  );

  return {
    async lookup(ticker: string): Promise<ApewisdomEntry | null> {
      const serialised = await cache.get(SNAPSHOT_KEY);
      const map = new Map(serialised.entries);
      return map.get(ticker) ?? null;
    },

    async board(limit: number = DEFAULT_BOARD_LIMIT): Promise<TrendingRow[]> {
      const serialised = await cache.get(SNAPSHOT_KEY);
      return serialised.entries
        .map(([ticker, e]) => ({
          ticker,
          name: e.name,
          rank: e.rank,
          mentions: e.mentions,
          mentions24hAgo: e.mentions24hAgo,
        }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, limit);
    },
  };
}

import type { KvStore } from "../lib/kv-store";
import type { ApewisdomEntry, ApewisdomSnapshot } from "../lib/apewisdom";
import { createTtlCache } from "../lib/ttl-cache";

const SNAPSHOT_KEY = "snapshot";
const TTL_MS = 15 * 60 * 1000; // 15 minutes per PRD

export type ApewisdomFetcher = () => Promise<ApewisdomSnapshot>;

export interface ApewisdomService {
  lookup(ticker: string): Promise<ApewisdomEntry | null>;
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
  };
}

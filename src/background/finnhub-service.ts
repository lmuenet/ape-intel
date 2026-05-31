import type { KvStore } from "../lib/kv-store";
import type { EarningsDate, NewsItem } from "../lib/finnhub";
import { createTtlCache } from "../lib/ttl-cache";

const NEWS_TTL_MS = 30 * 60 * 1000;
const EARNINGS_TTL_MS = 24 * 60 * 60 * 1000; // earnings dates change rarely
const KEY_NAME = "finnhub:apiKey";

export type NewsFetcher = (ticker: string, apiKey: string) => Promise<NewsItem[]>;
export type EarningsFetcher = (ticker: string, apiKey: string) => Promise<EarningsDate | null>;

export interface FinnhubService {
  news(ticker: string, force?: boolean): Promise<NewsItem[] | null>;
  earnings(ticker: string, force?: boolean): Promise<EarningsDate | null>;
}

export function createFinnhubService(
  store: KvStore,
  newsFetcher: NewsFetcher,
  earningsFetcher: EarningsFetcher,
): FinnhubService {
  const newsCache = createTtlCache<NewsItem[]>(
    store,
    async (ticker) => {
      // The outer gate in news() guarantees a key exists before the cache is queried.
      const key = (await store.get<string>(KEY_NAME))!;
      return newsFetcher(ticker, key);
    },
    { ttlMs: NEWS_TTL_MS, keyPrefix: "finnhub-news" },
  );

  const earningsCache = createTtlCache<EarningsDate | null>(
    store,
    async (ticker) => {
      // The outer gate in earnings() guarantees a key exists before the cache is queried.
      const key = (await store.get<string>(KEY_NAME))!;
      return earningsFetcher(ticker, key);
    },
    { ttlMs: EARNINGS_TTL_MS, keyPrefix: "finnhub-earnings" },
  );

  return {
    // Gate on the key BEFORE the cache so a missing key is never cached
    // (otherwise a null would be served for the whole TTL after the key is added).
    async news(ticker: string, force?: boolean): Promise<NewsItem[] | null> {
      if (!(await store.get<string>(KEY_NAME))) return null;
      return newsCache.get(ticker, { force });
    },
    async earnings(ticker: string, force?: boolean): Promise<EarningsDate | null> {
      if (!(await store.get<string>(KEY_NAME))) return null;
      return earningsCache.get(ticker, { force });
    },
  };
}

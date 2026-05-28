import type { KvStore } from "./kv-store";

export interface TtlCacheOptions {
  ttlMs: number;
  keyPrefix: string;
}

interface CachedEntry<T> {
  value: T;
  fetchedAt: number;
}

export interface TtlCache<T> {
  get(key: string): Promise<T>;
}

export function createTtlCache<T>(
  store: KvStore,
  fetcher: (key: string) => Promise<T>,
  options: TtlCacheOptions,
): TtlCache<T> {
  const fullKey = (key: string): string => `${options.keyPrefix}:${key}`;

  return {
    async get(key: string): Promise<T> {
      const entry = await store.get<CachedEntry<T>>(fullKey(key));
      if (entry !== undefined && Date.now() - entry.fetchedAt < options.ttlMs) {
        return entry.value;
      }
      const fresh = await fetcher(key);
      await store.set(fullKey(key), { value: fresh, fetchedAt: Date.now() });
      return fresh;
    },
  };
}

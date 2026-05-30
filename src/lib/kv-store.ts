export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createInMemoryKvStore(
  seed: Record<string, unknown> = {},
): KvStore {
  const data = new Map<string, unknown>(Object.entries(seed));
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return data.has(key) ? (data.get(key) as T) : undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, value);
    },
    async remove(key: string): Promise<void> {
      data.delete(key);
    },
  };
}

interface BrowserStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string): Promise<void>;
}

export function browserStorageKvStore(area: BrowserStorageArea): KvStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const result = await area.get(key);
      return key in result ? (result[key] as T) : undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await area.set({ [key]: value });
    },
    async remove(key: string): Promise<void> {
      await area.remove(key);
    },
  };
}

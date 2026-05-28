export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
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
  };
}

interface BrowserStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
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
  };
}

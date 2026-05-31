import type { KvStore } from "../lib/kv-store";
import type { LogEntry } from "../lib/logger";

export const LOG_BUFFER_KEY = "log:buffer";
const MAX_ENTRIES = 500;

export interface LogService {
  append(entry: LogEntry): Promise<void>;
  read(): Promise<LogEntry[]>;
  clear(): Promise<void>;
}

/**
 * The single, background-owned ring buffer for log entries. Appends are
 * serialized through a promise chain so concurrent writes (e.g. several content
 * scripts shipping at once) never lose entries to read-modify-write races, and
 * the buffer is FIFO-capped at 500.
 */
export function createLogService(store: KvStore): LogService {
  let chain: Promise<void> = Promise.resolve();

  const read = async (): Promise<LogEntry[]> =>
    (await store.get<LogEntry[]>(LOG_BUFFER_KEY)) ?? [];

  return {
    read,
    append(entry: LogEntry): Promise<void> {
      chain = chain.then(async () => {
        const buffer = await read();
        buffer.push(entry);
        if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
        await store.set(LOG_BUFFER_KEY, buffer);
      });
      return chain;
    },
    clear(): Promise<void> {
      chain = chain.then(() => store.remove(LOG_BUFFER_KEY));
      return chain;
    },
  };
}

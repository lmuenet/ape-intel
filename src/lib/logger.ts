export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = "background" | "content";

/** storage.local key holding the user's log-level override (set in Settings). */
export const LOG_LEVEL_KEY = "log:level";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: unknown;
}

export const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function isLogLevel(value: unknown): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}

/** Stored override wins; otherwise debug in dev builds, warn in production. */
export function resolveLevel(stored: LogLevel | undefined, isDev: boolean): LogLevel {
  if (isLogLevel(stored)) return stored;
  return isDev ? "debug" : "warn";
}

/** True when a message at `level` should be emitted given the `active` threshold. */
export function shouldLog(active: LogLevel, level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[active];
}

/** The console subset the logger mirrors to (injectable for tests). */
export interface LogSink {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface LoggerOptions {
  context: LogContext;
  /** Read per call so a live level change takes effect immediately. */
  getLevel: () => LogLevel;
  /** Persist the entry (background: ring buffer; content: message to background). */
  ship: (entry: LogEntry) => void;
  sink?: LogSink;
  now?: () => number;
}

export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

export function createLogger(options: LoggerOptions): Logger {
  const { context, getLevel, ship } = options;
  const sink = options.sink ?? console;
  const now = options.now ?? Date.now;

  const emit = (level: LogLevel, message: string, data?: unknown): void => {
    if (!shouldLog(getLevel(), level)) return;
    const entry: LogEntry = { ts: now(), level, context, message, ...(data !== undefined ? { data } : {}) };
    ship(entry);
    const prefix = `[ape-intel] ${message}`;
    if (data !== undefined) sink[level](prefix, data);
    else sink[level](prefix);
  };

  return {
    debug: (message, data) => emit("debug", message, data),
    info: (message, data) => emit("info", message, data),
    warn: (message, data) => emit("warn", message, data),
    error: (message, data) => emit("error", message, data),
  };
}

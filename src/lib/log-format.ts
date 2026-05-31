import { LEVEL_RANK, type LogEntry, type LogLevel } from "./logger";

export type LevelFilter = LogLevel | "all";

function timestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function stringifyData(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/** One human-readable line: "<local time> [LEVEL] (context) message <json data?>". */
export function formatLogEntry(entry: LogEntry): string {
  const base = `${timestamp(entry.ts)} [${entry.level.toUpperCase()}] (${entry.context}) ${entry.message}`;
  return entry.data !== undefined ? `${base} ${stringifyData(entry.data)}` : base;
}

/** Keep entries whose level rank is at or above the chosen threshold; "all" keeps everything. */
export function filterByLevel(entries: LogEntry[], level: LevelFilter): LogEntry[] {
  if (level === "all") return entries;
  const min = LEVEL_RANK[level];
  return entries.filter((e) => LEVEL_RANK[e.level] >= min);
}

export function logsToClipboard(entries: LogEntry[]): string {
  return entries.map(formatLogEntry).join("\n");
}

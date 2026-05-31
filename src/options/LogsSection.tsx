import { useState } from "preact/hooks";
import { formatLogEntry, filterByLevel, logsToClipboard, type LevelFilter } from "../lib/log-format";
import type { LogEntry, LogLevel } from "../lib/logger";

type Loadable = LogEntry[] | null | undefined;

export interface LogsSectionProps {
  level: LogLevel;
  onLevelChange: (level: LogLevel) => void;
  entries: Loadable; // undefined = loading, null = error, [] = empty
  onRefresh: () => void;
  onClear: () => void;
  writeClipboard?: (text: string) => Promise<void>;
}

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

export function LogsSection({
  level,
  onLevelChange,
  entries,
  onRefresh,
  onClear,
  writeClipboard = (t) => navigator.clipboard.writeText(t),
}: LogsSectionProps) {
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  // Buffer is appended newest-last; show newest-first.
  const filtered = Array.isArray(entries) ? filterByLevel(entries, filter).slice().reverse() : [];

  function copyAll(): void {
    writeClipboard(logsToClipboard(filtered)).then(
      () => setCopyState("copied"),
      () => setCopyState("error"),
    );
  }

  return (
    <section class="ape-options__section">
      <h2 class="ape-options__title">Logging</h2>
      <div class="ape-options__row">
        <label class="ape-options__field">
          <span>Log level</span>
          <select
            aria-label="Log level"
            value={level}
            onChange={(ev) => onLevelChange((ev.currentTarget as HTMLSelectElement).value as LogLevel)}
          >
            {LEVELS.map((l) => <option value={l}>{l}</option>)}
          </select>
        </label>
        <label class="ape-options__field">
          <span>Filter</span>
          <select
            aria-label="Log filter"
            value={filter}
            onChange={(ev) => setFilter((ev.currentTarget as HTMLSelectElement).value as LevelFilter)}
          >
            <option value="all">all</option>
            {LEVELS.map((l) => <option value={l}>{l}</option>)}
          </select>
        </label>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={onRefresh}>Refresh</button>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={copyAll}>
          {copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy all"}
        </button>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={onClear}>Clear</button>
      </div>
      <p class="ape-options__hint">Default level: debug in dev builds, warn in production.</p>
      {entries === undefined ? (
        <p class="ape-options__hint">Loading…</p>
      ) : entries === null ? (
        <p class="ape-options__hint ape-options__hint--error">Couldn't load logs.</p>
      ) : filtered.length === 0 ? (
        <p class="ape-options__hint">No log entries.</p>
      ) : (
        <pre class="ape-options__logs">{filtered.map((en) => formatLogEntry(en)).join("\n")}</pre>
      )}
    </section>
  );
}

# Settings / Options Page (Paket B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated Firefox Options page (full tab) with three sections — Finnhub key save/delete, AI export-prompt editor (writes the `export:prompt` override), and Logging (level selector + filterable/copyable/clearable view of the 500-entry ring buffer).

**Architecture:** Mirrors the popup entry (`index.html` → `index.tsx` → `render(<Component/>)`). Each section is a focused presentational Preact component with injected callbacks; `Options.tsx` owns storage/message I/O. A new pure `lib/log-format.ts` does log formatting/filtering. The background gains `log:read`/`log:clear` message types backed by the existing `logService`.

**Tech Stack:** TypeScript, Preact + preact/hooks, Vitest + @testing-library/preact, Firefox MV3 `browser.storage.local` / `browser.runtime` / `options_ui`, `@crxjs/vite-plugin`.

Design reference: `docs/superpowers/specs/2026-05-31-settings-options-page-design.md`. Decision record: `docs/adr/0010-copy-out-only-ai-with-parameterised-prompt.md`.

---

## File Structure

- `src/lib/log-format.ts` (create) — pure: `formatLogEntry`, `filterByLevel`, `logsToClipboard`, `LevelFilter`.
- `src/lib/log-format.test.ts` (create).
- `src/background/messages.ts` (modify) — `log:read` / `log:clear` types, handlers, routing.
- `src/background/messages.test.ts` (modify) — routing tests + factory defaults.
- `src/background/index.ts` (modify) — wire `readLog`/`clearLog` to `logService`.
- `src/options/KeySection.tsx` + `.test.tsx` (create) — Finnhub key.
- `src/options/PromptSection.tsx` + `.test.tsx` (create) — export-prompt editor.
- `src/options/LogsSection.tsx` + `.test.tsx` (create) — log level + logs view.
- `src/options/Options.tsx` + `.test.tsx` (create) — page shell, owns I/O.
- `src/options/options.css` (create) — dark-theme styling.
- `src/options/index.html` + `src/options/index.tsx` (create) — entry.
- `manifest.config.ts` (modify) — `options_ui`.

Build order: pure lib → background messages → the three presentational sections → Options wiring → manifest + HTML entry.

---

## Task 1: `lib/log-format.ts` — pure log formatting/filtering

**Files:** Create `src/lib/log-format.ts`; Test `src/lib/log-format.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/log-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatLogEntry, filterByLevel, logsToClipboard } from "./log-format";
import type { LogEntry } from "./logger";

const entry = (o: Partial<LogEntry> = {}): LogEntry => ({
  ts: Date.UTC(2026, 4, 31, 10, 30, 0),
  level: "info",
  context: "background",
  message: "hello",
  ...o,
});

describe("formatLogEntry", () => {
  it("includes level, context and message", () => {
    const out = formatLogEntry(entry({ level: "warn", context: "content", message: "boom" }));
    expect(out).toContain("[WARN]");
    expect(out).toContain("(content)");
    expect(out).toContain("boom");
  });
  it("appends JSON data when present", () => {
    expect(formatLogEntry(entry({ data: { a: 1 } }))).toContain('{"a":1}');
  });
  it("omits data when undefined", () => {
    expect(formatLogEntry(entry())).not.toContain("undefined");
  });
  it("falls back to String for unstringifiable data without throwing", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => formatLogEntry(entry({ data: cyclic }))).not.toThrow();
    expect(formatLogEntry(entry({ data: cyclic }))).toContain("[object Object]");
  });
});

describe("filterByLevel", () => {
  const entries = [
    entry({ level: "debug" }),
    entry({ level: "info" }),
    entry({ level: "warn" }),
    entry({ level: "error" }),
  ];
  it("returns everything for 'all'", () => {
    expect(filterByLevel(entries, "all")).toHaveLength(4);
  });
  it("returns entries at or above the chosen level rank", () => {
    expect(filterByLevel(entries, "warn").map((e) => e.level)).toEqual(["warn", "error"]);
    expect(filterByLevel(entries, "debug")).toHaveLength(4);
    expect(filterByLevel(entries, "error").map((e) => e.level)).toEqual(["error"]);
  });
});

describe("logsToClipboard", () => {
  it("joins formatted entries with newlines", () => {
    const out = logsToClipboard([entry({ message: "a" }), entry({ message: "b" })]);
    expect(out.split("\n")).toHaveLength(2);
    expect(out).toContain("a");
    expect(out).toContain("b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/log-format.test.ts`
Expected: FAIL — module `./log-format` not found.

- [ ] **Step 3: Implement `src/lib/log-format.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/log-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/log-format.ts src/lib/log-format.test.ts
git commit -m "feat(log): pure log-format helpers (format/filter/clipboard)"
```

---

## Task 2: Background `log:read` / `log:clear` messages

**Files:** Modify `src/background/messages.ts`, `src/background/index.ts`; Test `src/background/messages.test.ts`.

- [ ] **Step 1: Add the failing routing tests and factory defaults**

In `src/background/messages.test.ts`, add `readLog` and `clearLog` to the `handlers` factory object (after `appendLog: vi.fn(),`):

```ts
  readLog: vi.fn(),
  clearLog: vi.fn(),
```

Then add two tests inside the `describe("handleMessage", ...)` block (e.g. after the `"routes a log entry to the buffer"` test):

```ts
  it("routes log:read to readLog", async () => {
    const entries = [{ ts: 1, level: "warn" as const, context: "background" as const, message: "x" }];
    const readLog = vi.fn().mockResolvedValue(entries);
    await expect(handleMessage({ type: "log:read" }, handlers({ readLog }))).resolves.toBe(entries);
    expect(readLog).toHaveBeenCalledTimes(1);
  });

  it("routes log:clear to clearLog", async () => {
    const clearLog = vi.fn().mockResolvedValue(undefined);
    await handleMessage({ type: "log:clear" }, handlers({ clearLog }));
    expect(clearLog).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/messages.test.ts`
Expected: FAIL — `readLog`/`clearLog` not on `MessageHandlers` (type error) and no routing.

- [ ] **Step 3: Add the message types, handler types, and routing in `messages.ts`**

Add the message interfaces near the other message interfaces (after `LogMessage`):

```ts
export interface LogReadMessage { type: "log:read" }
export interface LogClearMessage { type: "log:clear" }
```

Add the handler function types near the other handler types (after `AppendLog`):

```ts
export type ReadLog = () => Promise<LogEntry[]>;
export type ClearLog = () => Promise<void>;
```

Add to the `MessageHandlers` interface (after `appendLog: AppendLog;`):

```ts
  readLog: ReadLog;
  clearLog: ClearLog;
```

Add `Promise<LogEntry[]>` to the `handleMessage` return union (insert a line alongside the other `Promise<...>` members, e.g. after `| Promise<FavouriteRow[]>`):

```ts
  | Promise<LogEntry[]>
```

Add the routing in `handleMessage`, immediately before the `if (isLogMessage(message))` line:

```ts
  if (isTypedMessage(message, "log:read")) return handlers.readLog();
  if (isTypedMessage(message, "log:clear")) return handlers.clearLog();
```

(`isTypedMessage` and the `LogEntry` import already exist in this file.)

- [ ] **Step 4: Wire the handlers in `background/index.ts`**

In the `handleMessage(message, { ... })` handlers object (after `appendLog: (entry) => logService.append(entry),`), add:

```ts
    readLog: () => logService.read(),
    clearLog: () => logService.clear(),
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/background/messages.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/background/messages.ts src/background/messages.test.ts src/background/index.ts
git commit -m "feat(messages): log:read and log:clear backed by logService"
```

---

## Task 3: `KeySection` — Finnhub key

**Files:** Create `src/options/KeySection.tsx`, `src/options/KeySection.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/options/KeySection.test.tsx`:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeySection } from "./KeySection";

afterEach(cleanup);

describe("<KeySection />", () => {
  it("prefills the input with the current value", () => {
    const { getByLabelText } = render(<KeySection value="KEY123" onSave={() => {}} onDelete={() => {}} />);
    expect((getByLabelText("Finnhub API key") as HTMLInputElement).value).toBe("KEY123");
  });
  it("shows a 'set' status when a value exists", () => {
    const { getByText } = render(<KeySection value="KEY" onSave={() => {}} onDelete={() => {}} />);
    expect(getByText("Key is set.")).toBeTruthy();
  });
  it("calls onSave with the trimmed value", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText } = render(<KeySection value="" onSave={onSave} onDelete={() => {}} />);
    fireEvent.input(getByLabelText("Finnhub API key"), { target: { value: "  ABC  " } });
    fireEvent.click(getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("ABC");
  });
  it("does not call onSave for a blank field", () => {
    const onSave = vi.fn();
    const { getByText } = render(<KeySection value="" onSave={onSave} onDelete={() => {}} />);
    fireEvent.click(getByText("Save"));
    expect(onSave).not.toHaveBeenCalled();
  });
  it("calls onDelete", () => {
    const onDelete = vi.fn();
    const { getByText } = render(<KeySection value="K" onSave={() => {}} onDelete={onDelete} />);
    fireEvent.click(getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/options/KeySection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/options/KeySection.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";

export interface KeySectionProps {
  value: string;
  onSave: (key: string) => void;
  onDelete: () => void;
}

export function KeySection({ value, onSave, onDelete }: KeySectionProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const saved = value.trim().length > 0;

  return (
    <section class="ape-options__section">
      <h2 class="ape-options__title">Finnhub API key</h2>
      <p class="ape-options__hint">
        {saved ? "Key is set." : "No key set — News and Earnings are disabled."}
      </p>
      <div class="ape-options__row">
        <input
          class="ape-options__input"
          type="text"
          aria-label="Finnhub API key"
          value={draft}
          placeholder="Paste your Finnhub key"
          onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
        />
        <button
          type="button"
          class="ape-options__btn"
          onClick={() => { const k = draft.trim(); if (k) onSave(k); }}
        >
          Save
        </button>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={onDelete}>
          Delete
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/options/KeySection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/options/KeySection.tsx src/options/KeySection.test.tsx
git commit -m "feat(options): KeySection (Finnhub key save/delete)"
```

---

## Task 4: `PromptSection` — export-prompt editor

**Files:** Create `src/options/PromptSection.tsx`, `src/options/PromptSection.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/options/PromptSection.test.tsx`:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptSection } from "./PromptSection";

afterEach(cleanup);

describe("<PromptSection />", () => {
  it("seeds the textarea with the value", () => {
    const { getByLabelText } = render(
      <PromptSection value="BASE PROMPT" isCustom={false} onSave={() => {}} onReset={() => {}} />,
    );
    expect((getByLabelText("Export prompt") as HTMLTextAreaElement).value).toBe("BASE PROMPT");
  });
  it("shows customised vs default status", () => {
    const { getByText, rerender } = render(
      <PromptSection value="x" isCustom={true} onSave={() => {}} onReset={() => {}} />,
    );
    expect(getByText("Customised.")).toBeTruthy();
    rerender(<PromptSection value="x" isCustom={false} onSave={() => {}} onReset={() => {}} />);
    expect(getByText("Using the default.")).toBeTruthy();
  });
  it("calls onSave with the edited text", () => {
    const onSave = vi.fn();
    const { getByLabelText, getByText } = render(
      <PromptSection value="x" isCustom={false} onSave={onSave} onReset={() => {}} />,
    );
    fireEvent.input(getByLabelText("Export prompt"), { target: { value: "edited" } });
    fireEvent.click(getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("edited");
  });
  it("calls onReset", () => {
    const onReset = vi.fn();
    const { getByText } = render(
      <PromptSection value="x" isCustom={true} onSave={() => {}} onReset={onReset} />,
    );
    fireEvent.click(getByText("Reset to default"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/options/PromptSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/options/PromptSection.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";

export interface PromptSectionProps {
  value: string;
  isCustom: boolean;
  onSave: (text: string) => void;
  onReset: () => void;
}

export function PromptSection({ value, isCustom, onSave, onReset }: PromptSectionProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <section class="ape-options__section">
      <h2 class="ape-options__title">AI export prompt</h2>
      <p class="ape-options__hint">
        The base instruction prepended to the briefing on copy.{" "}
        <span>{isCustom ? "Customised." : "Using the default."}</span> The risk/horizon trading profile is
        set per export in the Side Panel, not here.
      </p>
      <textarea
        class="ape-options__textarea"
        aria-label="Export prompt"
        rows={16}
        value={draft}
        onInput={(e) => setDraft((e.currentTarget as HTMLTextAreaElement).value)}
      />
      <div class="ape-options__row">
        <button type="button" class="ape-options__btn" onClick={() => onSave(draft)}>Save</button>
        <button type="button" class="ape-options__btn ape-options__btn--ghost" onClick={onReset}>
          Reset to default
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/options/PromptSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/options/PromptSection.tsx src/options/PromptSection.test.tsx
git commit -m "feat(options): PromptSection (export-prompt editor + reset)"
```

---

## Task 5: `LogsSection` — log level + logs view

**Files:** Create `src/options/LogsSection.tsx`, `src/options/LogsSection.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/options/LogsSection.test.tsx`:

```tsx
import { render, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogsSection } from "./LogsSection";
import type { LogEntry } from "../lib/logger";

afterEach(cleanup);

const e = (o: Partial<LogEntry>): LogEntry => ({ ts: 1, level: "info", context: "background", message: "m", ...o });

describe("<LogsSection />", () => {
  it("renders entries newest-first", () => {
    const { container } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[e({ message: "first" }), e({ message: "second" })]} onRefresh={() => {}} onClear={() => {}} />,
    );
    const text = container.querySelector(".ape-options__logs")!.textContent!;
    expect(text.indexOf("second")).toBeLessThan(text.indexOf("first"));
  });
  it("filters by level", () => {
    const { container, getByLabelText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[e({ level: "debug", message: "dbg" }), e({ level: "error", message: "err" })]} onRefresh={() => {}} onClear={() => {}} />,
    );
    fireEvent.change(getByLabelText("Log filter"), { target: { value: "error" } });
    const text = container.querySelector(".ape-options__logs")!.textContent!;
    expect(text).toContain("err");
    expect(text).not.toContain("dbg");
  });
  it("calls onLevelChange when the level select changes", () => {
    const onLevelChange = vi.fn();
    const { getByLabelText } = render(
      <LogsSection level="warn" onLevelChange={onLevelChange} entries={[]} onRefresh={() => {}} onClear={() => {}} />,
    );
    fireEvent.change(getByLabelText("Log level"), { target: { value: "debug" } });
    expect(onLevelChange).toHaveBeenCalledWith("debug");
  });
  it("calls onRefresh and onClear", () => {
    const onRefresh = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[]} onRefresh={onRefresh} onClear={onClear} />,
    );
    fireEvent.click(getByText("Refresh"));
    fireEvent.click(getByText("Clear"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it("copies filtered logs via the injected clipboard writer", () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={[e({ message: "xyz" })]} onRefresh={() => {}} onClear={() => {}} writeClipboard={writeClipboard} />,
    );
    fireEvent.click(getByText("Copy all"));
    expect(writeClipboard).toHaveBeenCalledTimes(1);
    expect(writeClipboard.mock.calls[0][0]).toContain("xyz");
  });
  it("shows loading, error and empty states", () => {
    const { rerender, getByText } = render(
      <LogsSection level="warn" onLevelChange={() => {}} entries={undefined} onRefresh={() => {}} onClear={() => {}} />,
    );
    expect(getByText("Loading…")).toBeTruthy();
    rerender(<LogsSection level="warn" onLevelChange={() => {}} entries={null} onRefresh={() => {}} onClear={() => {}} />);
    expect(getByText("Couldn't load logs.")).toBeTruthy();
    rerender(<LogsSection level="warn" onLevelChange={() => {}} entries={[]} onRefresh={() => {}} onClear={() => {}} />);
    expect(getByText("No log entries.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/options/LogsSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/options/LogsSection.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/options/LogsSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/options/LogsSection.tsx src/options/LogsSection.test.tsx
git commit -m "feat(options): LogsSection (level select + filterable log view)"
```

---

## Task 6: `Options` shell + `options.css`

**Files:** Create `src/options/Options.tsx`, `src/options/Options.test.tsx`, `src/options/options.css`.

- [ ] **Step 1: Write the failing test**

Create `src/options/Options.test.tsx`:

```tsx
import { render, cleanup, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Options } from "./Options";
import { createInMemoryKvStore } from "../lib/kv-store";

afterEach(cleanup);

describe("<Options />", () => {
  it("loads stored values into the sections and reads logs", async () => {
    const store = createInMemoryKvStore({ "finnhub:apiKey": "K1", "log:level": "error" });
    const send = vi.fn().mockResolvedValue([]);
    const { getByLabelText } = render(<Options store={store} send={send} />);
    await waitFor(() => expect((getByLabelText("Finnhub API key") as HTMLInputElement).value).toBe("K1"));
    expect((getByLabelText("Log level") as HTMLSelectElement).value).toBe("error");
    expect(send).toHaveBeenCalledWith({ type: "log:read" });
  });

  it("seeds the prompt with the default when no override is stored", async () => {
    const store = createInMemoryKvStore({});
    const send = vi.fn().mockResolvedValue([]);
    const { getByLabelText } = render(<Options store={store} send={send} />);
    await waitFor(() =>
      expect((getByLabelText("Export prompt") as HTMLTextAreaElement).value.length).toBeGreaterThan(50),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/options/Options.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/options/options.css`**

```css
.ape-options {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  font-family: system-ui, sans-serif;
  background: #111;
  color: #f3f3f3;
  min-height: 100vh;
  box-sizing: border-box;
}
.ape-options__brand {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 20px;
}
.ape-options__section {
  border-top: 1px solid #2a2a2a;
  padding: 16px 0;
}
.ape-options__title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
}
.ape-options__hint {
  font-size: 12px;
  color: #888;
  margin: 6px 0;
}
.ape-options__hint--error { color: #f87171; }
.ape-options__row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-wrap: wrap;
  margin: 8px 0;
}
.ape-options__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #888;
}
.ape-options__input {
  flex: 1;
  min-width: 220px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #2a2a2a;
  background: #1a1a1a;
  color: #f3f3f3;
  font-size: 12px;
}
.ape-options__textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #2a2a2a;
  background: #1a1a1a;
  color: #f3f3f3;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
}
.ape-options__field select,
.ape-options__input {
  font: inherit;
}
.ape-options__field select {
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid #2a2a2a;
  background: #1a1a1a;
  color: #f3f3f3;
}
.ape-options__btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: #4ade80;
  color: #111;
  font-weight: 600;
  font-size: 12px;
}
.ape-options__btn--ghost {
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #f3f3f3;
}
.ape-options__btn--ghost:hover { border-color: #4ade80; }
.ape-options__logs {
  max-height: 360px;
  overflow: auto;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 4: Implement `src/options/Options.tsx`**

```tsx
import { useEffect, useState } from "preact/hooks";
import { browserStorageKvStore, type KvStore } from "../lib/kv-store";
import { DEFAULT_EXPORT_PROMPT } from "../lib/briefing";
import { LOG_LEVEL_KEY, resolveLevel, type LogLevel, type LogEntry } from "../lib/logger";
import { KeySection } from "./KeySection";
import { PromptSection } from "./PromptSection";
import { LogsSection } from "./LogsSection";
import "./options.css";

export type Send = <T>(message: unknown) => Promise<T>;

const defaultSend: Send = async (message) => (await browser.runtime.sendMessage(message)) as never;
const defaultStore = (): KvStore => browserStorageKvStore(browser.storage.local);

const FINNHUB_KEY = "finnhub:apiKey";
const PROMPT_KEY = "export:prompt";

type Loadable = LogEntry[] | null | undefined;

export interface OptionsProps {
  send?: Send;
  store?: KvStore;
}

export function Options({ send = defaultSend, store = defaultStore() }: OptionsProps) {
  const [finnhubKey, setFinnhubKey] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_EXPORT_PROMPT);
  const [promptCustom, setPromptCustom] = useState(false);
  const [level, setLevel] = useState<LogLevel>(resolveLevel(undefined, import.meta.env.DEV));
  const [logs, setLogs] = useState<Loadable>(undefined);

  function loadLogs(): void {
    setLogs(undefined);
    send<LogEntry[]>({ type: "log:read" }).then(setLogs, () => setLogs(null));
  }

  useEffect(() => {
    store.get<string>(FINNHUB_KEY).then((k) => setFinnhubKey(k ?? ""));
    store.get<string>(PROMPT_KEY).then((p) => {
      if (p !== undefined) {
        setPrompt(p);
        setPromptCustom(true);
      }
    });
    store.get<LogLevel>(LOG_LEVEL_KEY).then((l) => setLevel(resolveLevel(l, import.meta.env.DEV)));
    loadLogs();
  }, [store, send]);

  function onSaveKey(key: string): void { setFinnhubKey(key); void store.set(FINNHUB_KEY, key); }
  function onDeleteKey(): void { setFinnhubKey(""); void store.remove(FINNHUB_KEY); }
  function onSavePrompt(text: string): void { setPrompt(text); setPromptCustom(true); void store.set(PROMPT_KEY, text); }
  function onResetPrompt(): void { setPrompt(DEFAULT_EXPORT_PROMPT); setPromptCustom(false); void store.remove(PROMPT_KEY); }
  function onLevelChange(l: LogLevel): void { setLevel(l); void store.set(LOG_LEVEL_KEY, l); }
  function onClearLogs(): void { send({ type: "log:clear" }).then(loadLogs, loadLogs); }

  return (
    <div class="ape-options">
      <header class="ape-options__brand">Ape Intel — Settings</header>
      <KeySection value={finnhubKey} onSave={onSaveKey} onDelete={onDeleteKey} />
      <PromptSection value={prompt} isCustom={promptCustom} onSave={onSavePrompt} onReset={onResetPrompt} />
      <LogsSection level={level} onLevelChange={onLevelChange} entries={logs} onRefresh={loadLogs} onClear={onClearLogs} />
    </div>
  );
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/options/Options.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/options/Options.tsx src/options/Options.test.tsx src/options/options.css
git commit -m "feat(options): Options shell wiring storage + log messages"
```

---

## Task 7: Manifest `options_ui` + HTML entry

**Files:** Modify `manifest.config.ts`; Create `src/options/index.html`, `src/options/index.tsx`.

- [ ] **Step 1: Create `src/options/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ape Intel — Settings</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/options/index.tsx`**

```tsx
import { render } from "preact";
import { Options } from "./Options";

const root = document.getElementById("app");
if (root) render(<Options />, root);
```

- [ ] **Step 3: Register `options_ui` in `manifest.config.ts`**

Add this property to the `defineManifest({ ... })` object, immediately after the `action: { ... }` block:

```ts
  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },
```

- [ ] **Step 4: Typecheck, full suite, build**

Run: `npm run typecheck`
Expected: no errors.
Run: `npm run test`
Expected: entire suite PASS.
Run: `npm run build`
Expected: clean build; `dist/` contains the options page assets.

- [ ] **Step 5: Manual smoke test**

Load the extension (`about:debugging` → Temporary Add-on). Open `about:addons` → Ape Intel → the three-dots / gear → **Preferences** (opens in a full tab because `open_in_tab: true`):
- **Finnhub key:** shows current key (or "No key set"); Save persists; reopening the page shows the saved value; Delete clears it. Open a broker page afterwards to confirm News/Earnings react to the key.
- **AI export prompt:** shows the default text; edit + Save; on a broker page, "Copy briefing for AI" now uses the edited prompt. "Reset to default" reverts (the copy uses `DEFAULT_EXPORT_PROMPT` again).
- **Logging:** change level (e.g. to `debug`); trigger some extension activity; click Refresh → entries appear, newest first; the Filter narrows by level; Copy all puts the formatted text on the clipboard; Clear empties the buffer.

- [ ] **Step 6: Commit**

```bash
git add manifest.config.ts src/options/index.html src/options/index.tsx
git commit -m "feat(options): register options_ui page + entry"
```

---

## Self-Review notes

- **Spec coverage:** Finnhub key save/delete (Task 3 + Options wiring Task 6); export-prompt editor + reset-removes-override (Task 4 + Task 6); log level selector writing `LOG_LEVEL_KEY` (Task 5 + Task 6); logs view with filter/refresh/copy/clear (Task 5 + Task 6); `log:read`/`log:clear` messages (Task 2); pure `log-format` (Task 1); dedicated `options_ui` full-tab page (Task 7); dark-theme styling (Task 6). Inline NewsSection key input left untouched (not in any task — correct, per spec §2). Trading-Profile knobs not added here — correct.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `LevelFilter`, `formatLogEntry`, `filterByLevel`, `logsToClipboard` (Task 1) used identically in Task 5; `ReadLog`/`ClearLog`/`readLog`/`clearLog` consistent across Tasks 2/6; `KeySectionProps`/`PromptSectionProps`/`LogsSectionProps` props match the `Options` call sites in Task 6; storage keys `finnhub:apiKey`, `export:prompt`, `LOG_LEVEL_KEY` consistent with Paket A and the logger.
- **Cross-package consistency:** `export:prompt` is read by `content/index.tsx` (Paket A) and written/removed here — the override seam closes as designed.

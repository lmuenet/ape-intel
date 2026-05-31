# Settings / Options Page (Paket B) — Design

Status: Accepted
Date: 2026-05-31

Implements PRD **F9** (Settings), slimmed per **ADR-0010**: the v1 AI path is
copy-out only, so the panel carries no provider keys, no active-provider, and no
AI-depth toggle. It is the dedicated **Options page** decided during the Settings
grilling. Companion to **Paket A** (AI export flow v2), which created the
`export:prompt` override seam this page now writes.

---

## 1. Goal

A single dedicated Options page (`about:addons` → "Preferences", full tab) with
three sections:

1. **Finnhub key** — save / delete the `finnhub:apiKey` data-source key.
2. **AI export prompt** — edit the base Export Prompt template (`export:prompt`),
   or reset to the built-in default.
3. **Logging** — choose the log level and view / filter / copy / clear the
   background-owned 500-entry log ring buffer.

## 2. Scope boundaries

**In scope:**
- A new `src/options` entry (HTML + Preact), registered via `options_ui`.
- The three sections above.
- Two new background message types: `log:read`, `log:clear`.
- A pure `lib/log-format.ts` for log filtering/formatting/clipboard text.

**Out of scope (ADR-0010 / parked / other packages):**
- Anthropic/OpenAI keys, active-provider selection, AI-depth toggle (dropped from v1).
- The risk/horizon Trading Profile knobs — those live in the Side Panel per export
  (Paket A), not here. The prompt section notes this but does not control them.
- Removing the inline Finnhub-key input in `NewsSection` — it stays (both write the
  same `finnhub:apiKey`); confirmed during design.
- Live log tailing (auto-update while open) — the view loads on open and on an
  explicit Refresh, no `storage.onChanged` subscription.
- README / manifest-version bump and release — a separate later step.

## 3. Architecture / module layout

Mirrors the existing popup entry (`src/popup/index.html` → `index.tsx` →
`render(<App/>)`). Each section is its own focused, independently testable
component; storage/message I/O is injected so components are testable without the
extension runtime (the established `App.test` / `SidePanel.test` pattern).

- `src/options/index.html` — copy of the popup HTML (title "Ape Intel — Settings",
  `<div id="app">`, `<script type="module" src="./index.tsx">`).
- `src/options/index.tsx` — `const root = document.getElementById("app"); if (root) render(<Options/>, root);`
- `src/options/Options.tsx` — page shell; owns the injected `send` and `store`
  defaults (same `defaultSend` shape as `popup/App.tsx`), renders the three sections.
- `src/options/KeySection.tsx` — Finnhub key.
- `src/options/PromptSection.tsx` — export-prompt editor.
- `src/options/LogsSection.tsx` — log level + logs view.
- `src/options/options.css` — page styling (dark theme consistent with the panel:
  `#111` bg, `#f3f3f3` text, `#1a1a1a` inputs, `#2a2a2a` borders, `#4ade80` accent).
- `src/lib/log-format.ts` — pure helpers (see §6).

**Manifest:** add
```ts
options_ui: { page: "src/options/index.html", open_in_tab: true },
```

## 4. Section behaviour

### 4a. Finnhub key (`KeySection`)
- **Props:** `value: string` (loaded key, "" if none), `onSave: (key: string) => void`,
  `onDelete: () => void`.
- On mount `Options` reads `finnhub:apiKey` from `store` and passes it as `value`;
  the input is **prefilled and visible** (personal tool, plaintext storage anyway).
- "Save" writes `finnhub:apiKey` (trimmed); "Delete" removes it and clears the field.
- A status line reflects whether a key is currently set (derived from the loaded
  value), updated after save/delete. Empty save (blank field) is treated as a no-op,
  not a write (use Delete to clear).

### 4b. AI export prompt (`PromptSection`)
- **Props:** `value: string` (stored override or the default), `isCustom: boolean`
  (true when an `export:prompt` override is stored), `onSave: (text) => void`,
  `onReset: () => void`.
- `Options` reads `export:prompt`; seeds the textarea with it, or with
  `DEFAULT_EXPORT_PROMPT` (imported from `lib/briefing`) when unset.
- "Save" writes `export:prompt`. "Reset to default" **removes** `export:prompt`
  (so `buildClipboardPayload` falls back to `DEFAULT_EXPORT_PROMPT` — the Paket A
  seam) and reseeds the textarea with the default.
- A one-line note states the Trading Profile (risk/horizon) is set per export in the
  Side Panel, not here.

### 4c. Logging (`LogsSection`)
- **Log level selector:** a `<select>` of `debug | info | warn | error`. On change,
  writes `LOG_LEVEL_KEY` to `store`. Background and content already cache the active
  level and refresh on `storage.onChanged`, so the change takes effect live with no
  reload. The current value is read from `store` on mount; when unset the select
  shows the resolved default and a small note ("default: debug in dev, warn in
  production").
- **Logs view:** a level filter `<select>` (`all | debug | info | warn | error`),
  "Refresh", "Copy all", and "Clear" buttons, and the rendered list.
  - Entries are fetched via `send({ type: "log:read" })` on mount and on Refresh.
  - Rendered **newest first**, each line `formatLogEntry(entry)` (see §6), filtered
    by `filterByLevel`.
  - "Copy all" writes `logsToClipboard(filtered)` to the clipboard.
  - "Clear" calls `send({ type: "log:clear" })` then refreshes (empty list).
  - Loading / error / empty states: "Loading…", "Couldn't load logs.", "No log
    entries." (mirrors the popup's `Section` helper states).

## 5. Background message additions

`src/background/messages.ts`:
- New interfaces `LogReadMessage { type: "log:read" }` and
  `LogClearMessage { type: "log:clear" }`.
- New handler types `ReadLog = () => Promise<LogEntry[]>` and
  `ClearLog = () => Promise<void>`; added to `MessageHandlers` as `readLog` / `clearLog`.
- `handleMessage` routes `log:read` → `handlers.readLog()` and `log:clear` →
  `handlers.clearLog()` (using the existing `isTypedMessage` guard).
- The return-union type of `handleMessage` gains `Promise<LogEntry[]>` (already has
  `Promise<void>` from `appendLog`).

`src/background/index.ts`: wire `readLog: () => logService.read()` and
`clearLog: () => logService.clear()` into the `handleMessage` handlers object.

## 6. Pure logic — `lib/log-format.ts`

All pure, fully unit-tested; no browser access.

- `formatLogEntry(entry: LogEntry): string` — e.g.
  `` `${iso(ts)} [${level.toUpperCase()}] (${context}) ${message}` `` plus, when
  `data !== undefined`, a trailing `` ` ${JSON.stringify(data)}` ``. `iso(ts)` is the
  local-time `HH:MM:SS` plus date, formatted via `Date`. (Defensive: a `data` value
  that can't be `JSON.stringify`'d — e.g. a cyclic object — falls back to `String(data)`.)
- `filterByLevel(entries: LogEntry[], level: LogLevel | "all"): LogEntry[]` —
  returns entries whose level **rank ≥** the chosen level's rank (reusing
  `LEVEL_RANK` from `lib/logger`); `"all"` returns everything.
- `logsToClipboard(entries: LogEntry[]): string` — `entries.map(formatLogEntry).join("\n")`.

`LogLevel`, `LogEntry`, `LEVEL_RANK` are imported from `lib/logger`.

## 7. Error handling / edge cases

- `log:read` rejection → `LogsSection` shows "Couldn't load logs." (load state `null`).
- Empty buffer → "No log entries."
- Clipboard write failure on "Copy all" → a transient "Copy failed" button state
  (same idiom as the Side Panel copy button).
- Storage writes (key/prompt/level) are fire-and-forget with a transient "Saved"
  confirmation; a rejected write logs a warning (no logger in the options context —
  use `console.warn`, consistent with not shipping a 4th logger context).
- Malformed stored `LOG_LEVEL_KEY` → the select falls back to the resolved default
  via `resolveLevel`.

## 8. Testing

- `src/lib/log-format.test.ts` (new): `formatLogEntry` with/without `data` and with
  an unstringifiable `data`; `filterByLevel` for each threshold and `"all"`;
  `logsToClipboard` join.
- `src/background/messages.test.ts` (extend): `log:read` routes to `readLog`,
  `log:clear` routes to `clearLog`.
- `src/options/KeySection.test.tsx`: prefill, save (calls `onSave` with trimmed
  value), delete (calls `onDelete`, clears field), blank-save no-op.
- `src/options/PromptSection.test.tsx`: seeds with value, save calls `onSave`,
  reset calls `onReset` and reseeds with the default.
- `src/options/LogsSection.test.tsx`: renders entries newest-first, level filter
  hides lower-rank entries, copy-all writes clipboard, clear calls the injected
  clearer, loading/error/empty states.
- `src/options/Options.test.tsx` (light): mounts, reads store/send, passes values
  to sections (seam coverage like `App.test`).

## 9. Build order (for the plan)

1. `lib/log-format.ts` + tests (pure, no UI).
2. Background `log:read` / `log:clear` message types + handlers + `messages.test`,
   wired in `background/index.ts`.
3. `options_ui` in the manifest + `src/options` entry shell (`index.html`,
   `index.tsx`, `Options.tsx` rendering empty sections) — loads in `about:addons`.
4. `KeySection` + test; wire into `Options`.
5. `PromptSection` + test; wire into `Options`.
6. `LogsSection` + test; wire into `Options`.
7. Full suite green; manual smoke in Firefox (open Preferences, exercise each section).

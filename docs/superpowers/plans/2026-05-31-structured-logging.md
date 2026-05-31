# Structured Logging (F10) — Implementation Plan

> Implements PRD **F10**. A structured logger (DEBUG/INFO/WARN/ERROR) that mirrors
> to the console and appends to a **single 500-entry ring buffer** in
> `storage.local`, owned by the background. Default level is build-mode based
> (`DEV` → debug, else warn) with a stored `log:level` override. TDD throughout.
>
> Decisions (grilled 2026-05-31):
> - **One central ring buffer, background-owned.** Any context emits; the content
>   script ships entries to the background via a `log` message; the background is
>   the sole writer (serialized appends → no read-modify-write races). Key
>   `log:buffer`, capped at 500 (FIFO).
> - **Level:** `resolveLevel(stored, isDev)` = `stored ?? (isDev ? "debug" : "warn")`.
>   Stored override lives at `log:level` (set later by the Settings panel);
>   `import.meta.env.DEV` supplies the default. Same gate for console + buffer.
> - **Adopt now:** the 11 `console.warn("[ape-intel] …")` calls in
>   `content/index.tsx` move onto the logger so the buffer carries real content.
> - **Never log secrets** (the Finnhub/BYOK keys): only log messages + safe data.

## Entry shape

```ts
type LogLevel = "debug" | "info" | "warn" | "error";
interface LogEntry { ts: number; level: LogLevel; context: "background" | "content"; message: string; data?: unknown }
```

## Task 1: Log level + entry primitives — TDD

**Files:** `src/lib/logger.ts`, `src/lib/logger.test.ts`

- [ ] Failing tests: `LEVEL_RANK` orders debug<info<warn<error; `resolveLevel`
  returns the stored level when set, else `debug` when `isDev`, else `warn`;
  a `shouldLog(active, level)` predicate gates correctly.
- [ ] Implement the types, `LEVEL_RANK`, `resolveLevel`, `shouldLog`.
- [ ] Green + typecheck. Commit `feat(log): level resolution primitives`.

## Task 2: `createLogger` — TDD

**Files:** `src/lib/logger.ts` (+ same test file)

- [ ] Failing tests: `createLogger({ context, getLevel, ship, sink })` returns
  `{ debug, info, warn, error }`; a call at/above the active level both calls
  `ship` with a well-formed entry (ts, level, context, message, data) and writes
  to the injected console `sink`; a call below the active level does neither.
  `getLevel` is read per call (so a level change takes effect live).
- [ ] Implement. `ship` and `sink` are injected (defaults: real console + a noop
  ship that the entry-point overrides). `ts` via an injectable `now` (default
  `Date.now`).
- [ ] Green + typecheck. Commit `feat(log): structured logger with console mirror + ship`.

## Task 3: Background ring buffer — TDD

**Files:** `src/background/log-service.ts`, `src/background/log-service.test.ts`

- [ ] Failing tests: `append` persists entries under `log:buffer`; the buffer is
  FIFO-capped at 500 (a 501st append drops the oldest); concurrent appends are
  serialized (no lost entries — fire several without awaiting, then `read`);
  `read` returns `[]` when empty; `clear` empties it.
- [ ] Implement `createLogService(store)` = `{ append, read, clear }` with a
  promise-chain to serialize writes and a `MAX = 500` trim. Constants
  `LOG_BUFFER_KEY = "log:buffer"`, `LOG_LEVEL_KEY = "log:level"`.
- [ ] Green + typecheck. Commit `feat(log): background-owned 500-entry ring buffer`.

## Task 4: Route the `log` message — TDD

**Files:** `src/background/messages.ts`, `src/background/messages.test.ts`

- [ ] Failing test: `handleMessage({ type: "log", entry }, handlers)` calls
  `handlers.appendLog(entry)` and returns its promise; a malformed log message
  (no entry) is unhandled (`undefined`).
- [ ] Add `LogMessage`, an `isLogMessage` guard, `AppendLog` handler type +
  `appendLog` on `MessageHandlers`, and the route.
- [ ] Green + typecheck. Commit `feat(messages): route log entries to the buffer`.

## Task 5: Wire both contexts + adopt the logger — glue

**Files:** `src/background/index.ts`, `src/content/index.tsx`

- [ ] Background: create `logService`; pass `appendLog: (e) => logService.append(e)`
  to `handleMessage`. Build a background logger (`context: "background"`,
  `ship = logService.append`, console sink) with a cached active level read from
  `log:level` on startup and refreshed via `browser.storage.onChanged`.
- [ ] Content: build a logger (`context: "content"`, `ship` = fire-and-forget
  `send({ type: "log", entry })` with a swallowed catch to avoid loops, cached
  level via `storage.onChanged`). Replace the 11 `console.warn("[ape-intel] …")`
  calls with `logger.warn("…", e)`.
- [ ] `npm run typecheck` green; `npm run build` clean.
- [ ] Commit `feat(content,background): adopt the structured logger`.

## Task 6: Full suite + manual verification

- [ ] `npm run typecheck && npm test` green; `npm run build` clean.
- [ ] Interactive (Firefox): trigger a warn path (e.g. a failing lookup); confirm
  the dev console still shows it and `browser.storage.local` `log:buffer` grows;
  set `log:level` to `error` and confirm warns stop being recorded.

## Done criteria
- A structured logger usable from both contexts; one 500-entry FIFO ring buffer
  in `storage.local`, background-owned, race-free.
- Level = stored override ?? build-mode default; same gate for console + buffer.
- Existing content warnings flow through the logger.
- All tests + typecheck green; build loadable. (Settings Logs-view consumes
  `logService.read()` / `clear()` in the next task, F9.)

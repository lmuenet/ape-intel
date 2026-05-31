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

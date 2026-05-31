import { describe, expect, it, vi } from "vitest";
import {
  LEVEL_RANK,
  resolveLevel,
  shouldLog,
  createLogger,
  type LogEntry,
  type LogLevel,
} from "./logger";

describe("LEVEL_RANK", () => {
  it("orders debug < info < warn < error", () => {
    expect(LEVEL_RANK.debug).toBeLessThan(LEVEL_RANK.info);
    expect(LEVEL_RANK.info).toBeLessThan(LEVEL_RANK.warn);
    expect(LEVEL_RANK.warn).toBeLessThan(LEVEL_RANK.error);
  });
});

describe("resolveLevel", () => {
  it("uses the stored level when set", () => {
    expect(resolveLevel("error", true)).toBe("error");
    expect(resolveLevel("info", false)).toBe("info");
  });
  it("defaults to debug in dev and warn otherwise", () => {
    expect(resolveLevel(undefined, true)).toBe("debug");
    expect(resolveLevel(undefined, false)).toBe("warn");
  });
  it("ignores an invalid stored value and falls back to the build default", () => {
    expect(resolveLevel("nonsense" as unknown as LogLevel, false)).toBe("warn");
  });
});

describe("shouldLog", () => {
  it("emits at or above the active level only", () => {
    expect(shouldLog("warn", "warn")).toBe(true);
    expect(shouldLog("warn", "error")).toBe(true);
    expect(shouldLog("warn", "info")).toBe(false);
    expect(shouldLog("debug", "debug")).toBe(true);
  });
});

describe("createLogger", () => {
  const setup = (active: LogLevel) => {
    const ship = vi.fn();
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createLogger({
      context: "content",
      getLevel: () => active,
      ship,
      sink,
      now: () => 1000,
    });
    return { logger, ship, sink };
  };

  it("ships a well-formed entry and mirrors to the console when level passes", () => {
    const { logger, ship, sink } = setup("debug");
    logger.warn("lookup failed", { ticker: "AAPL" });
    expect(ship).toHaveBeenCalledTimes(1);
    expect(ship).toHaveBeenCalledWith({
      ts: 1000,
      level: "warn",
      context: "content",
      message: "lookup failed",
      data: { ticker: "AAPL" },
    } satisfies LogEntry);
    expect(sink.warn).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the call is below the active level", () => {
    const { logger, ship, sink } = setup("error");
    logger.warn("ignored");
    expect(ship).not.toHaveBeenCalled();
    expect(sink.warn).not.toHaveBeenCalled();
  });

  it("reads the level per call so a change takes effect live", () => {
    let active: LogLevel = "error";
    const ship = vi.fn();
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createLogger({ context: "background", getLevel: () => active, ship, sink });
    logger.warn("first");
    expect(ship).not.toHaveBeenCalled();
    active = "debug";
    logger.warn("second");
    expect(ship).toHaveBeenCalledTimes(1);
  });
});

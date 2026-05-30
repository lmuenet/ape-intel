import { describe, expect, it } from "vitest";
import { appendDay, isSnapshotDue, utcDay, type DailySnapshot } from "./snapshot-history";

const rec = (date: string, mentions: number, rank: number | null = null): DailySnapshot => ({ date, mentions, rank });

describe("utcDay", () => {
  it("formats a timestamp as a UTC YYYY-MM-DD string", () => {
    expect(utcDay(Date.parse("2026-05-30T23:59:00Z"))).toBe("2026-05-30");
  });
});

describe("isSnapshotDue", () => {
  it("is due when no snapshot has run", () => {
    expect(isSnapshotDue(undefined, "2026-05-30")).toBe(true);
  });
  it("is due when the last run was a previous day", () => {
    expect(isSnapshotDue("2026-05-29", "2026-05-30")).toBe(true);
  });
  it("is not due when already run today", () => {
    expect(isSnapshotDue("2026-05-30", "2026-05-30")).toBe(false);
  });
});

describe("appendDay", () => {
  it("appends to an empty history", () => {
    expect(appendDay([], rec("2026-05-30", 5))).toEqual([rec("2026-05-30", 5)]);
  });
  it("replaces a same-date entry (idempotent re-run)", () => {
    expect(appendDay([rec("2026-05-30", 1, 1)], rec("2026-05-30", 9, 2)))
      .toEqual([rec("2026-05-30", 9, 2)]);
  });
  it("keeps only the most recent 7 days, sorted ascending", () => {
    const history = [
      rec("2026-05-24", 1), rec("2026-05-25", 2), rec("2026-05-26", 3),
      rec("2026-05-27", 4), rec("2026-05-28", 5), rec("2026-05-29", 6),
      rec("2026-05-30", 7),
    ];
    const result = appendDay(history, rec("2026-05-31", 8));
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual(rec("2026-05-25", 2));
    expect(result[6]).toEqual(rec("2026-05-31", 8));
  });
});
